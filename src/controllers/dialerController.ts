// // src/controllers/dialer.controller.ts
// import { Request, Response } from "express";
// import { generateStringeeToken } from "../utils/stringeeToken.js";
// import { CallLog } from "../models/CallLog.js";
// import { Lead } from "../models/Lead.js";
// import { createLeadActivity } from "../services/lead.service.js";

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
//     // Safely fallback to empty objects if req.body or req.query are undefined
//     const body = req.body || {};
//     const query = req.query || {};

//     // Stringee passes incoming call payload in query (GET) or body (POST)
//     const rawFrom = query.from || body.from || "";
//     const rawTo = query.to || body.to || "";
//     const customData =
//       query.custom_data ||
//       body.custom_data ||
//       query.customData ||
//       body.customData ||
//       "";

//     const cleanTo = String(rawTo).replace(/[^\d+]/g, "");
//     const rawHotline = process.env.STRINGEE_HOTLINE_NUMBER || "917971730788";
//     const cleanHotline = String(rawHotline).replace(/[^\d+]/g, "");

//     // SCCO payload for Stringee Programmable Voice
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
//         customData:
//           typeof customData === "object"
//             ? JSON.stringify(customData)
//             : String(customData),
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

// export const handleCallEventsWebhook = async (req: Request, res: Response) => {
//   try {
//     const {
//       call_id,
//       call_status,
//       duration,
//       record_url,
//       custom_data,
//       from_number,
//       to_number,
//       from,
//       to,
//     } = req.body;

//     let meta: any = {};
//     if (custom_data) {
//       try {
//         meta = typeof custom_data === "string" ? JSON.parse(custom_data) : custom_data;
//       } catch {
//         meta = {};
//       }
//     }

//     const callerFrom = from_number || from || meta.fromNumber || "Unknown";
//     const callerTo = to_number || to || meta.toNumber || "Unknown";

//     // Normalize call status to fit Mongoose Schema enum
//     let normalizedStatus: "started" | "answered" | "ended" | "missed" | "rejected" = "started";
//     if (call_status === "ended") normalizedStatus = "ended";
//     else if (call_status === "answered") normalizedStatus = "answered";
//     else if (call_status === "busy" || call_status === "rejected") normalizedStatus = "rejected";
//     else if (call_status === "no_answer") normalizedStatus = "missed";

//     // 1. Save or Update Call Log
//     if (call_id) {
//       await CallLog.findOneAndUpdate(
//         { callId: call_id },
//         {
//           $set: {
//             callStatus: normalizedStatus,
//             duration: duration || 0,
//             fromNumber: callerFrom,
//             toNumber: callerTo,
//             ...(record_url && { recordingUrl: record_url }),
//             ...(meta.leadId && { lead: meta.leadId }),
//             ...(meta.userId && { caller: meta.userId }),
//             ...(meta.branchId && { branch: meta.branchId }),
//           },
//         },
//         { upsert: true, new: true }
//       );
//     }

//     // 2. Create Lead Activity Log
//     if (normalizedStatus === "ended" && meta.leadId && meta.userId) {
//       await createLeadActivity({
//         leadId: meta.leadId,
//         activityType: "call_logged",
//         performedBy: meta.userId,
//         remark: `Outbound call ended. Duration: ${duration || 0}s`,
//         metadata: {
//           callId: call_id,
//           recordingUrl: record_url,
//           branchId: meta.branchId,
//         },
//       });
//     }

//     return res.status(200).json({ status: "success" });
//   } catch (error: any) {
//     console.error("[Call Event Error]:", error);
//     return res.status(500).json({ message: error.message });
//   }
// };

// export const getLeadCallHistoryController = async (
//   req: Request,
//   res: Response,
// ) => {
//   try {
//     const { leadId } = req.params;

//     const lead = await Lead.findById(leadId);
//     if (!lead || lead.isDeleted) {
//       return res.status(404).json({ message: "Lead not found" });
//     }

//     const query: any = { lead: leadId };

//     if (req.user?.role !== "head") {
//       query.branch = req.user?.branches;
//     }

//     const calls = await CallLog.find(query)
//       .populate("caller", "name email role")
//       .sort({ createdAt: -1 });

//     return res.status(200).json({ success: true, data: calls });
//   } catch (error: any) {
//     return res.status(500).json({ message: error.message });
//   }
// };

import { Request, Response } from "express";
import { generateStringeeToken } from "../utils/stringeeToken.js";
import { CallLog } from "../models/CallLog.js";
import { Lead } from "../models/Lead.js";
import { createLeadActivity } from "../services/lead.service.js";
import { User } from "../models/User.js";

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

// export const handleAnswerUrlWebhook = async (req: Request, res: Response) => {
//   try {
//     const body = req.body || {};
//     const query = req.query || {};

//     const rawTo = query.to || body.to || "";
//     const customData =
//       query.custom_data ||
//       body.custom_data ||
//       query.customData ||
//       body.customData ||
//       "";

//     const cleanTo = String(rawTo).replace(/[^\d+]/g, "");
//     const rawHotline = process.env.STRINGEE_HOTLINE_NUMBER || "917971730788";
//     const cleanHotline = String(rawHotline).replace(/[^\d+]/g, "");

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
//         customData:
//           typeof customData === "object"
//             ? JSON.stringify(customData)
//             : String(customData),
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

export const handleAnswerUrlWebhook = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const query = req.query || {};

    const rawTo = query.to || body.to || "";

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
    const rawHotline = process.env.STRINGEE_HOTLINE_NUMBER || "917971730788";
    const cleanHotline = String(rawHotline).replace(/[^\d+]/g, "");

    // SCCO: You MUST include customData inside the connect action
    const scco = [
      {
        action: "connect",
        from: {
          type: "external",
          number: cleanHotline,
          alias: cleanHotline,
        },
        to: {
          type: "external",
          number: cleanTo,
          alias: cleanTo,
        },
        customData: customDataString, // <--- THIS FORWARDS METADATA TO EVENT WEBHOOKS
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

// export const handleCallEventsWebhook = async (req: Request, res: Response) => {
//   try {
//     const {
//       call_id,
//       call_status,
//       event_type,
//       duration,
//       record_url,
//       custom_data,
//       from_number,
//       to_number,
//       from,
//       to,
//     } = req.body;

//     if (!call_id) {
//       return res.status(200).json({ status: "ignored_no_call_id" });
//     }

//     let meta: any = {};
//     if (custom_data) {
//       try {
//         meta = typeof custom_data === "string" ? JSON.parse(custom_data) : custom_data;
//       } catch {
//         meta = {};
//       }
//     }

//     const callerFrom = from_number || from || meta.fromNumber || "Unknown";
//     const callerTo = to_number || to || meta.toNumber || "Unknown";

//     // Combine status checking to handle different Stringee payload types
//     const statusRaw = (call_status || event_type || "").toLowerCase();

//     let normalizedStatus: "started" | "answered" | "ended" | "missed" | "rejected" = "started";
//     if (statusRaw.includes("ended") || statusRaw.includes("completed")) normalizedStatus = "ended";
//     else if (statusRaw.includes("answered")) normalizedStatus = "answered";
//     else if (statusRaw.includes("busy") || statusRaw.includes("rejected")) normalizedStatus = "rejected";
//     else if (statusRaw.includes("no_answer") || statusRaw.includes("missed")) normalizedStatus = "missed";

//     // 1. Save or Update Call Log safely
//     await CallLog.findOneAndUpdate(
//       { callId: call_id },
//       {
//         $set: {
//           callStatus: normalizedStatus,
//           duration: duration || 0,
//           fromNumber: callerFrom,
//           toNumber: callerTo,
//           ...(record_url && { recordingUrl: record_url }),
//           ...(meta.leadId && { lead: meta.leadId }),
//           ...(meta.userId && { caller: meta.userId }),
//           ...(meta.branchId && { branch: meta.branchId }),
//         },
//       },
//       { upsert: true, new: true }
//     );

//     // 2. Log activity only on completion
//     if (normalizedStatus === "ended" && meta.leadId && meta.userId) {
//       await createLeadActivity({
//         leadId: meta.leadId,
//         activityType: "call_logged",
//         performedBy: meta.userId,
//         remark: `Outbound call ended. Duration: ${duration || 0}s`,
//         metadata: {
//           callId: call_id,
//           recordingUrl: record_url,
//           branchId: meta.branchId,
//         },
//       });
//     }

//     return res.status(200).json({ status: "success" });
//   } catch (error: any) {
//     console.error("[Call Event Error]:", error);
//     return res.status(500).json({ message: error.message });
//   }
// };
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
    const callerFrom = (typeof from === "object" ? from?.number : from) || "Unknown";
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
    let normalizedStatus: "started" | "answered" | "ended" | "missed" | "rejected" = "started";

    if (rawStatus.includes("ended") || rawStatus.includes("completed")) {
      normalizedStatus = "ended";
    } else if (rawStatus.includes("answered")) {
      normalizedStatus = "answered";
    } else if (rawStatus.includes("busy") || rawStatus.includes("rejected")) {
      normalizedStatus = "rejected";
    } else if (rawStatus.includes("no_answer") || rawStatus.includes("missed")) {
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
      { upsert: true, returnDocument: "after" }
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

    // Check branch scope using $in for Array safety
    if (req.user?.role !== "head" && req.user?.branches) {
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