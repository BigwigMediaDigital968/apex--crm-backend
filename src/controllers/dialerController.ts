import { Request, Response } from "express";
import { generateStringeeToken } from "../utils/stringeeToken.js";
import { CallLog } from "../models/CallLog.js";
import { Lead } from "../models/Lead.js";
import { createLeadActivity } from "../services/lead.service.js";
import { User } from "../models/User.js";
import { StringeeNumber } from "../models/StringeeNumber.js";

// export const getStringeeTokenController = async (
//   req: Request,
//   res: Response,
// ) => {
//   try {
//     if (!req.user) {
//       return res.status(401).json({ message: "Unauthorized" });
//     }

//     const token = generateStringeeToken(req.user.id.toString());
//     return res.status(200).json({ success: true, token });
//   } catch (error: any) {
//     return res.status(500).json({ message: error.message });
//   }
// };

// export const handleAnswerUrlWebhook = async (req: Request, res: Response) => {
//   try {
//     const body = req.body || {};
//     const query = req.query || {};

//     const rawTo = query.to || body.to || "";

//     // Stringee forwards client customData as custom_data or customData in query/body
//     const rawCustomData =
//       query.custom_data ||
//       body.custom_data ||
//       query.customData ||
//       body.customData ||
//       "";

//     let customDataString = "";
//     if (typeof rawCustomData === "object") {
//       customDataString = JSON.stringify(rawCustomData);
//     } else {
//       customDataString = String(rawCustomData);
//     }

//     const cleanTo = String(rawTo).replace(/[^\d+]/g, "");
//     const rawHotline = process.env.STRINGEE_HOTLINE_NUMBER || "917971730788";
//     const cleanHotline = String(rawHotline).replace(/[^\d+]/g, "");

//     // SCCO: You MUST include customData inside the connect action
//     const scco = [
//       {
//         action: "connect",
//         from: {
//           type: "external",
//           number: cleanHotline,
//           alias: cleanHotline,
//         },
//         to: {
//           type: "external",
//           number: cleanTo,
//           alias: cleanTo,
//         },
//         customData: customDataString, // <--- THIS FORWARDS METADATA TO EVENT WEBHOOKS
//         timeout: 45,
//         record: true,
//       },
//     ];

//     res.setHeader("Content-Type", "application/json");
//     return res.status(200).json(scco);
//   } catch (error: any) {
//     console.error("[Stringee Webhook Error]:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

export const getStringeeTokenController = async (
  req: Request,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = generateStringeeToken(req.user.id.toString());
    return res.status(200).json({ success: true, token });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const handleAnswerUrlWebhook = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const query = req.query || {};

    const rawTo = query.to || body.to || "";
    const rawFrom = query.from || body.from || ""; // User ID or App Client ID from WebRTC SDK

    // Stringee forwards client customData as custom_data or customData in query/body
    const rawCustomData =
      query.custom_data ||
      body.custom_data ||
      query.customData ||
      body.customData ||
      "";

    let customDataString = "";
    if (typeof rawCustomData === "object") {
      customDataString = JSON.stringify(rawCustomData);
    } else {
      customDataString = String(rawCustomData);
    }

    const cleanTo = String(rawTo).replace(/[^\d+]/g, "");

    // 1. Dynamic Caller ID Resolution based on assigned employee number
    let outboundCallerId =
      process.env.STRINGEE_HOTLINE_NUMBER || "917971730788";

    if (rawFrom) {
      const assignedNumberDoc = await StringeeNumber.findOne({
        assignedTo: rawFrom,
        isActive: true,
      }).lean();

      if (assignedNumberDoc?.phoneNumber) {
        outboundCallerId = assignedNumberDoc.phoneNumber;
      }
    }

    const cleanCallerId = String(outboundCallerId).replace(/[^\d+]/g, "");

    // 2. SCCO Response with dynamic caller ID
    const scco = [
      {
        action: "connect",
        from: {
          type: "external",
          number: cleanCallerId,
          alias: cleanCallerId,
        },
        to: {
          type: "external",
          number: cleanTo,
          alias: cleanTo,
        },
        customData: customDataString,
        timeout: 45,
        record: true,
      },
    ];

    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(scco);
  } catch (error: any) {
    console.error("[Stringee Webhook Error]:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const handleCallEventsWebhook = async (req: Request, res: Response) => {
  try {
    const {
      call_id,
      call_status,
      event_type,
      duration,
      record_url,
      request_from_user_id,
      actor,
      from,
      to,
    } = req.body;

    if (!call_id) {
      return res.status(200).json({ status: "ignored_no_call_id" });
    }

    // 1. Extract Phone Numbers safely
    const callerFrom =
      (typeof from === "object" ? from?.number : from) || "Unknown";
    const callerTo = (typeof to === "object" ? to?.number : to) || "Unknown";

    // 2. Resolve User & Branch using request_from_user_id
    const rawUserId = request_from_user_id || actor;
    let userId: string | null = null;
    let branchId: string | null = null;

    if (rawUserId) {
      const user = await User.findById(rawUserId).select("_id branches").lean();
      if (user) {
        userId = user._id.toString();
        if (user.branches?.length) {
          branchId = Array.isArray(user.branches)
            ? user?.branches[0]?.toString()
            : (user.branches as any).toString();
        }
      }
    }

    // 3. Resolve Lead by matching destination phone number
    let leadId: string | null = null;
    if (callerTo && callerTo !== "Unknown") {
      const cleanPhone = callerTo.slice(-10); // Extract last 10 digits
      const matchedLead = await Lead.findOne({
        phone: new RegExp(cleanPhone + "$"),
        isDeleted: { $ne: true },
      })
        .select("_id")
        .lean();

      if (matchedLead) {
        leadId = matchedLead._id.toString();
      }
    }

    // 4. Normalize Status
    const rawStatus = String(call_status || event_type || "").toLowerCase();
    let normalizedStatus:
      | "started"
      | "answered"
      | "ended"
      | "missed"
      | "rejected" = "started";

    if (rawStatus.includes("ended") || rawStatus.includes("completed")) {
      normalizedStatus = "ended";
    } else if (rawStatus.includes("answered")) {
      normalizedStatus = "answered";
    } else if (rawStatus.includes("busy") || rawStatus.includes("rejected")) {
      normalizedStatus = "rejected";
    } else if (
      rawStatus.includes("no_answer") ||
      rawStatus.includes("missed")
    ) {
      normalizedStatus = "missed";
    }

    // 5. Construct Update Object
    const updateData: any = {
      callStatus: normalizedStatus,
      duration: duration || 0,
      fromNumber: String(callerFrom),
      toNumber: String(callerTo),
    };

    if (record_url) updateData.recordingUrl = record_url;
    if (userId) updateData.caller = userId;
    if (branchId) updateData.branch = branchId;
    if (leadId) updateData.lead = leadId;

    // 6. Upsert Call Log into DB
    await CallLog.findOneAndUpdate(
      { callId: call_id },
      { $set: updateData },
      { upsert: true, returnDocument: "after" },
    );

    // 7. Create Lead Activity Timeline Record on Completion
    if (normalizedStatus === "ended" && leadId && userId) {
      await createLeadActivity({
        leadId,
        activityType: "call_logged",
        performedBy: userId,
        remark: `Outbound call ended. Duration: ${duration || 0}s`,
        metadata: {
          callId: call_id,
          recordingUrl: record_url,
          branchId,
        },
      });
    }

    return res.status(200).json({ status: "success" });
  } catch (error: any) {
    console.error("[Call Event Error]:", error);
    return res.status(500).json({ message: error.message });
  }
};

export const getLeadCallHistoryController = async (
  req: Request,
  res: Response,
) => {
  try {
    const { leadId } = req.params;

    const lead = await Lead.findById(leadId);
    if (!lead || lead.isDeleted) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const query: any = { lead: leadId };

    // Scope by caller for standard users (non-head roles)
    if (req.user?.role !== "head") {
      query.caller = req.user?.id;
    } else if (req.user?.branches) {
      // Head role sees calls in their branch scope
      query.branch = Array.isArray(req.user.branches)
        ? { $in: req.user.branches }
        : req.user.branches;
    }

    const calls = await CallLog.find(query)
      .populate("caller", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: calls });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/v1/dialer/logs
 * Serves both:
 * 1. Dialer UI Recent Widget (?limit=10)
 * 2. Dedicated Call History Page (?page=1&limit=25&status=ended&search=...)
 */
export const getCallLogs = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    const { status, leadId, userId, branchId, search } = req.query;

    // Dynamic Filter Construction
    const filter: any = {};

    // 1. Role-based scoping: Non-head roles can only view their own calls
    if (req.user?.role !== "head") {
      filter.caller = req.user?.id;
    } else {
      // Head roles can explicitly filter by caller if passed in query
      if (userId) filter.caller = userId;
      if (branchId) filter.branch = branchId;
    }

    // 2. Query parameters filters
    if (status) filter.callStatus = status;
    if (leadId) filter.lead = leadId;

    // Search by Phone Number
    if (search) {
      filter.$or = [
        { toNumber: new RegExp(String(search), "i") },
        { fromNumber: new RegExp(String(search), "i") },
      ];
    }

    const [logs, total] = await Promise.all([
      CallLog.find(filter)
        .populate("lead", "name phone email company avatar")
        .populate("caller", "name email avatar")
        .populate("branch", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CallLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[Get Call Logs Error]:", error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/v1/dialer/logs/:id
 * Details view for a specific call session
 */
export const getCallLogById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const log = await CallLog.findById(id)
      .populate("lead")
      .populate("caller", "name email")
      .populate("branch", "name")
      .lean();

    if (!log) {
      return res.status(404).json({ message: "Call log record not found" });
    }

    return res.status(200).json({ success: true, data: log });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
