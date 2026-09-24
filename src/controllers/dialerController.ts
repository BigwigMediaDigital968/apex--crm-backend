// import { Request, Response } from "express";
// import { Types } from "mongoose";
// import { generateStringeeToken } from "../utils/stringeeToken.js";
// import { CallLog } from "../models/CallLog.js";
// import { Lead } from "../models/Lead.js";
// import { createLeadActivity } from "../services/lead.service.js";
// import { User } from "../models/User.js";
// import { StringeeNumber } from "../models/StringeeNumber.js";

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
//     const rawFrom = query.from || body.from || ""; // User ID or App Client ID from WebRTC SDK

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

//     // 1. Dynamic Caller ID Resolution based on assigned employee number
//     let outboundCallerId =
//       process.env.STRINGEE_HOTLINE_NUMBER || "917971730788";

//     if (rawFrom) {
//       const assignedNumberDoc = await StringeeNumber.findOne({
//         assignedTo: rawFrom,
//         isActive: true,
//       }).lean();

//       if (assignedNumberDoc?.phoneNumber) {
//         outboundCallerId = assignedNumberDoc.phoneNumber;
//       }
//     }

//     const cleanCallerId = String(outboundCallerId).replace(/[^\d+]/g, "");

//     // 2. SCCO Response with dynamic caller ID
//     const scco = [
//       {
//         action: "record",
//         eventUrl: `${process.env.BACKEND_URL}/stringee/call-events`, // Explicitly direct recording callbacks
//         format: "mp3",
//       },
//       {
//         action: "connect",
//         from: {
//           type: "external",
//           number: cleanCallerId,
//           alias: cleanCallerId,
//         },
//         to: {
//           type: "external",
//           number: cleanTo,
//           alias: cleanTo,
//         },
//         customData: customDataString,
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
//       event_type,
//       duration,
//       record_url,
//       recording_url,
//       recordUrl,
//       request_from_user_id,
//       actor,
//       from,
//       to,
//     } = req.body;

//     if (!call_id) {
//       return res.status(200).json({ status: "ignored_no_call_id" });
//     }

//     // 1. Extract Phone Numbers safely
//     const callerFrom =
//       (typeof from === "object" ? from?.number : from) || "Unknown";
//     const callerTo = (typeof to === "object" ? to?.number : to) || "Unknown";

//     // 2. Resolve User & Branch using request_from_user_id
//     const rawUserId = request_from_user_id || actor;
//     let userId: string | null = null;
//     let branchId: string | null = null;

//     if (rawUserId) {
//       const user = await User.findById(rawUserId).select("_id branches").lean();
//       if (user) {
//         userId = user._id.toString();
//         if (user.branches?.length) {
//           branchId = Array.isArray(user.branches)
//             ? user?.branches[0]?.toString()
//             : (user.branches as any).toString();
//         }
//       }
//     }

//     // 3. Resolve Lead by matching destination phone number
//     let leadId: string | null = null;
//     if (callerTo && callerTo !== "Unknown") {
//       const cleanPhone = callerTo.slice(-10); // Extract last 10 digits
//       const matchedLead = await Lead.findOne({
//         phone: new RegExp(cleanPhone + "$"),
//         isDeleted: { $ne: true },
//       })
//         .select("_id")
//         .lean();

//       if (matchedLead) {
//         leadId = matchedLead._id.toString();
//       }
//     }

//     // 4. Normalize Status
//     const rawStatus = String(call_status || event_type || "").toLowerCase();
//     let normalizedStatus:
//       | "started"
//       | "answered"
//       | "ended"
//       | "missed"
//       | "rejected" = "started";

//     if (rawStatus.includes("ended") || rawStatus.includes("completed")) {
//       normalizedStatus = "ended";
//     } else if (rawStatus.includes("answered")) {
//       normalizedStatus = "answered";
//     } else if (rawStatus.includes("busy") || rawStatus.includes("rejected")) {
//       normalizedStatus = "rejected";
//     } else if (
//       rawStatus.includes("no_answer") ||
//       rawStatus.includes("missed")
//     ) {
//       normalizedStatus = "missed";
//     }

//     // 5. Construct Update Object
//     const updateData: any = {
//       callStatus: normalizedStatus,
//       duration: duration || 0,
//       fromNumber: String(callerFrom),
//       toNumber: String(callerTo),
//     };

//     if (record_url) updateData.recordingUrl = record_url;
//     if (userId) updateData.caller = userId;
//     if (branchId) updateData.branch = branchId;
//     if (leadId) updateData.lead = leadId;

//     // 6. Upsert Call Log into DB
//     await CallLog.findOneAndUpdate(
//       { callId: call_id },
//       { $set: updateData },
//       { upsert: true, returnDocument: "after" },
//     );

//     // 7. Create Lead Activity Timeline Record on Completion
//     if (normalizedStatus === "ended" && leadId && userId) {
//       await createLeadActivity({
//         leadId,
//         activityType: "call_logged",
//         performedBy: userId,
//         remark: `Outbound call ended. Duration: ${duration || 0}s`,
//         metadata: {
//           callId: call_id,
//           recordingUrl: record_url,
//           branchId,
//         },
//       });
//     }

//     return res.status(200).json({ status: "success" });
//   } catch (error: any) {
//     console.error("[Call Event Error]:", error);
//     return res.status(500).json({ message: error.message });
//   }
// };

// // export const handleCallEventsWebhook = async (req: Request, res: Response) => {
// //   try {
// //     const {
// //       call_id,
// //       call_status,
// //       event_type,
// //       duration,
// //       record_url,
// //       recording_url, // Stringee often uses recording_url or recordUrl
// //       recordUrl,
// //       request_from_user_id,
// //       actor,
// //       from,
// //       to,
// //     } = req.body;

// //     if (!call_id) {
// //       return res.status(200).json({ status: "ignored_no_call_id" });
// //     }

// //     // Capture recording URL from any potential field key Stringee passes
// //     const finalRecordingUrl = record_url || recording_url || recordUrl || "";

// //     // 1. Extract Phone Numbers safely
// //     const callerFrom =
// //       (typeof from === "object" ? from?.number : from) || "Unknown";
// //     const callerTo = (typeof to === "object" ? to?.number : to) || "Unknown";

// //     // 2. Resolve User & Branch using request_from_user_id
// //     const rawUserId = request_from_user_id || actor;
// //     let userId: string | null = null;
// //     let branchId: string | null = null;

// //     if (rawUserId) {
// //       const user = await User.findById(rawUserId).select("_id branches").lean();
// //       if (user) {
// //         userId = user._id.toString();
// //         if (user.branches?.length) {
// //           branchId = Array.isArray(user.branches)
// //             ? user?.branches[0]?.toString()
// //             : (user.branches as any).toString();
// //         }
// //       }
// //     }

// //     // 3. Resolve Lead by matching destination phone number
// //     let leadId: string | null = null;
// //     if (callerTo && callerTo !== "Unknown") {
// //       const cleanPhone = callerTo.slice(-10);
// //       const matchedLead = await Lead.findOne({
// //         phone: new RegExp(cleanPhone + "$"),
// //         isDeleted: { $ne: true },
// //       })
// //         .select("_id")
// //         .lean();

// //       if (matchedLead) {
// //         leadId = matchedLead._id.toString();
// //       }
// //     }

// //     // 4. Normalize Status
// //     const rawStatus = String(call_status || event_type || "").toLowerCase();
// //     let normalizedStatus:
// //       | "started"
// //       | "answered"
// //       | "ended"
// //       | "missed"
// //       | "rejected" = "started";

// //     if (rawStatus.includes("ended") || rawStatus.includes("completed")) {
// //       normalizedStatus = "ended";
// //     } else if (rawStatus.includes("answered")) {
// //       normalizedStatus = "answered";
// //     } else if (rawStatus.includes("busy") || rawStatus.includes("rejected")) {
// //       normalizedStatus = "rejected";
// //     } else if (
// //       rawStatus.includes("no_answer") ||
// //       rawStatus.includes("missed")
// //     ) {
// //       normalizedStatus = "missed";
// //     }

// //     // 5. Construct Update Object
// //     const updateData: any = {
// //       callStatus: normalizedStatus,
// //       duration: duration || 0,
// //       fromNumber: String(callerFrom),
// //       toNumber: String(callerTo),
// //     };

// //     // Store recording URL whenever available
// //     if (finalRecordingUrl) {
// //       updateData.recordingUrl = finalRecordingUrl;
// //     }
// //     if (userId) updateData.caller = userId;
// //     if (branchId) updateData.branch = branchId;
// //     if (leadId) updateData.lead = leadId;

// //     // 6. Upsert Call Log into DB
// //     const updatedLog = await CallLog.findOneAndUpdate(
// //       { callId: call_id },
// //       { $set: updateData },
// //       { upsert: true, returnDocument: "after" },
// //     );

// //     // 7. Handle Dedicated Async Recording Event from Stringee
// //     if (rawStatus.includes("record") && finalRecordingUrl) {
// //       await CallLog.findOneAndUpdate(
// //         { callId: call_id },
// //         { $set: { recordingUrl: finalRecordingUrl } },
// //       );
// //     }

// //     // 8. Create Lead Activity Timeline Record on Completion
// //     if (normalizedStatus === "ended" && leadId && userId) {
// //       await createLeadActivity({
// //         leadId,
// //         activityType: "call_logged",
// //         performedBy: userId,
// //         remark: `Outbound call ended. Duration: ${duration || 0}s`,
// //         metadata: {
// //           callId: call_id,
// //           recordingUrl: updatedLog?.recordingUrl || finalRecordingUrl,
// //           branchId,
// //         },
// //       });
// //     }

// //     return res.status(200).json({ status: "success" });
// //   } catch (error: any) {
// //     console.error("[Call Event Error]:", error);
// //     return res.status(500).json({ message: error.message });
// //   }
// // };

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

//     // Scope by caller for standard users (non-head roles)
//     if (req.user?.role !== "head") {
//       query.caller = req.user?.id;
//     } else if (req.user?.branches) {
//       // Head role sees calls in their branch scope
//       query.branch = Array.isArray(req.user.branches)
//         ? { $in: req.user.branches }
//         : req.user.branches;
//     }

//     const calls = await CallLog.find(query)
//       .populate("caller", "name email role")
//       .sort({ createdAt: -1 });

//     return res.status(200).json({ success: true, data: calls });
//   } catch (error: any) {
//     return res.status(500).json({ message: error.message });
//   }
// };

// /**
//  * GET /api/v1/dialer/logs
//  * Serves both:
//  * 1. Dialer UI Recent Widget (?limit=10)
//  * 2. Dedicated Call History Page (?page=1&limit=25&status=ended&search=...)
//  */
// // export const getCallLogs = async (req: Request, res: Response) => {
// //   try {
// //     const limit = parseInt(req.query.limit as string) || 10;
// //     const page = parseInt(req.query.page as string) || 1;
// //     const skip = (page - 1) * limit;

// //     const { status, leadId, userId, branchId, search } = req.query;

// //     // Dynamic Filter Construction
// //     const filter: any = {};

// //     // 1. Role-based scoping: Non-head roles can only view their own calls
// //     if (req.user?.role !== "head") {
// //       filter.caller = req.user?.id;
// //     } else {
// //       // Head roles can explicitly filter by caller if passed in query
// //       if (userId) filter.caller = userId;
// //       if (branchId) filter.branch = branchId;
// //     }

// //     // 2. Query parameters filters
// //     if (status) filter.callStatus = status;
// //     if (leadId) filter.lead = leadId;

// //     // Search by Phone Number
// //     if (search) {
// //       filter.$or = [
// //         { toNumber: new RegExp(String(search), "i") },
// //         { fromNumber: new RegExp(String(search), "i") },
// //       ];
// //     }

// //     const [logs, total] = await Promise.all([
// //       CallLog.find(filter)
// //         .populate("lead", "name phone email company avatar")
// //         .populate("caller", "name email avatar")
// //         .populate("branch", "name")
// //         .sort({ createdAt: -1 })
// //         .skip(skip)
// //         .limit(limit)
// //         .lean(),
// //       CallLog.countDocuments(filter),
// //     ]);

// //     return res.status(200).json({
// //       success: true,
// //       data: logs,
// //       pagination: {
// //         total,
// //         page,
// //         limit,
// //         totalPages: Math.ceil(total / limit),
// //       },
// //     });
// //   } catch (error: any) {
// //     console.error("[Get Call Logs Error]:", error);
// //     return res.status(500).json({ message: error.message });
// //   }
// // };

// export const getCallLogs = async (req: Request, res: Response) => {
//   try {
//     const limit = parseInt(req.query.limit as string) || 10;
//     const page = parseInt(req.query.page as string) || 1;
//     const skip = (page - 1) * limit;

//     const { status, leadId, userId, branchId, search, startDate, endDate } =
//       req.query;

//     // Dynamic Filter Construction
//     const filter: any = {};

//     // find() casts id strings to ObjectIds for us, but aggregate() does not —
//     // and the summary below runs the same filter through an aggregation, so
//     // the ids have to be cast up front or the $match silently returns nothing.
//     // Anything that isn't a valid id is passed through untouched so the
//     // existing CastError behaviour is preserved.
//     const toObjectId = (value: unknown): unknown => {
//       const raw = String(value);
//       return Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : value;
//     };

//     // 1. Role-based scoping: Non-head roles can only view their own calls
//     if (req.user?.role !== "head") {
//       filter.caller = toObjectId(req.user?.id);
//     } else {
//       // Head roles can explicitly filter by caller if passed in query
//       if (userId) filter.caller = toObjectId(userId);
//       if (branchId) filter.branch = toObjectId(branchId);
//     }

//     // 2. Query parameters filters
//     if (status) filter.callStatus = status;
//     if (leadId) filter.lead = toObjectId(leadId);

//     // 3. Date Range Filtering (startDate & endDate)
//     if (startDate || endDate) {
//       filter.createdAt = {};
//       if (startDate) {
//         // Start of the day (00:00:00.000)
//         filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
//       }
//       if (endDate) {
//         // End of the day (23:59:59.999)
//         filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
//       }
//     }

//     // 4. Unified Search (Phone Number + Lead Name + Caller/Agent Name)
//     if (search) {
//       const searchRegex = new RegExp(String(search), "i");

//       // Find matching Lead IDs by name or phone
//       const matchedLeads = await Lead.find({
//         $or: [{ name: searchRegex }, { phone: searchRegex }],
//         isDeleted: { $ne: true },
//       })
//         .select("_id")
//         .lean();

//       // Find matching User/Agent IDs by name
//       const matchedUsers = await User.find({
//         name: searchRegex,
//       })
//         .select("_id")
//         .lean();

//       const leadIds = matchedLeads.map((l) => l._id);
//       const userIds = matchedUsers.map((u) => u._id);

//       filter.$or = [
//         { toNumber: searchRegex },
//         { fromNumber: searchRegex },
//         ...(leadIds.length > 0 ? [{ lead: { $in: leadIds } }] : []),
//         ...(userIds.length > 0 ? [{ caller: { $in: userIds } }] : []),
//       ];
//     }

//     // Summary metrics are aggregated over the *whole* filtered result set, not
//     // just the current page, so the KPI cards answer "what does this filter
//     // select?" rather than "what happens to be on screen right now?".
//     const [logs, total, summary] = await Promise.all([
//       CallLog.find(filter)
//         .populate("lead", "name phone email company avatar")
//         .populate("caller", "name email avatar")
//         .populate("branch", "name")
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),
//       CallLog.countDocuments(filter),
//       CallLog.aggregate([
//         { $match: filter },
//         {
//           $group: {
//             _id: null,
//             totalCalls: { $sum: 1 },
//             totalSeconds: { $sum: { $ifNull: ["$duration", 0] } },
//             answeredCalls: {
//               $sum: {
//                 $cond: [{ $in: ["$callStatus", ["answered", "ended"]] }, 1, 0],
//               },
//             },
//             missedCalls: {
//               $sum: {
//                 $cond: [{ $in: ["$callStatus", ["missed", "rejected"]] }, 1, 0],
//               },
//             },
//           },
//         },
//       ]),
//     ]);

//     const stats = {
//       totalCalls: summary[0]?.totalCalls ?? 0,
//       totalSeconds: summary[0]?.totalSeconds ?? 0,
//       answeredCalls: summary[0]?.answeredCalls ?? 0,
//       missedCalls: summary[0]?.missedCalls ?? 0,
//     };

//     return res.status(200).json({
//       success: true,
//       data: logs,
//       stats,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error: any) {
//     console.error("[Get Call Logs Error]:", error);
//     return res.status(500).json({ message: error.message });
//   }
// };

// /**
//  * GET /api/v1/dialer/logs/:id
//  * Details view for a specific call session
//  */
// export const getCallLogById = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const log = await CallLog.findById(id)
//       .populate("lead")
//       .populate("caller", "name email")
//       .populate("branch", "name")
//       .lean();

//     if (!log) {
//       return res.status(404).json({ message: "Call log record not found" });
//     }

//     return res.status(200).json({ success: true, data: log });
//   } catch (error: any) {
//     return res.status(500).json({ message: error.message });
//   }
// };

import { Request, Response } from "express";
import { Types } from "mongoose";
import { generateStringeeToken } from "../utils/stringeeToken.js";
import { CallLog } from "../models/CallLog.js";
import { Lead } from "../models/Lead.js";
import { createLeadActivity } from "../services/lead.service.js";
import { User } from "../models/User.js";
import { StringeeNumber } from "../models/StringeeNumber.js";

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

/**
 * Stringee Answer URL Webhook
 * Returned SCCO structure per Stringee Web SDK specification
 */
export const handleAnswerUrlWebhook = async (req: Request, res: Response) => {
  console.log("=== [STRINGEE ANSWER URL WEBHOOK TRIGGERED] ===");
  console.log("Query:", JSON.stringify(req.query, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));

  try {
    const body = req.body || {};
    const query = req.query || {};

    const rawTo = query.to || body.to || "";
    const rawFrom = query.from || body.from || "";

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

    // 1. Dynamic Caller ID Resolution
    let outboundCallerId =
      process.env.STRINGEE_HOTLINE_NUMBER || "917944412839";

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
    const eventWebhookUrl = `${process.env.BACKEND_URL}/api/v1/dialer/events`;

    // 2. Standard Stringee SCCO Payload Response
    const scco = [
      {
        action: "record",
        eventUrl: eventWebhookUrl,
        format: "wav",
      },
      {
        action: "connect",
        from: {
          type: "internal",
          number: cleanCallerId,
          alias: cleanCallerId,
        },
        to: {
          type: "external",
          number: cleanTo,
          alias: cleanTo,
        },
        customData: customDataString,
        timeout: 60,
      },
    ];

    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(scco);
  } catch (error: any) {
    console.error("[Stringee Webhook Error]:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Stringee Call Events Webhook
 * Manages Call Status, Call Failures/Unanswered calls, and Recording URLs
 */
export const handleCallEventsWebhook = async (req: Request, res: Response) => {
  console.log("=== [STRINGEE EVENT WEBHOOK TRIGGERED] ===");
  console.log("Query:", JSON.stringify(req.query, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));

  try {
    const payload = { ...req.query, ...req.body };

    const {
      call_id,
      call_status,
      event_type,
      action,
      duration,
      record_url,
      recording_url,
      recordUrl,
      request_from_user_id,
      actor,
      from,
      to,
      sip_code,
      reason,
    } = payload;

    if (!call_id) {
      return res.status(200).json({ status: "ignored_no_call_id" });
    }

    // Capture recording URL across all potential payload keys
    const finalRecordingUrl =
      record_url ||
      recording_url ||
      recordUrl ||
      payload?.recording?.url ||
      payload?.recording_url ||
      "";

    const rawEventType = String(
      event_type || action || call_status || "",
    ).toLowerCase();

    // ------------------------------------------------------------------------
    // 1. DEDICATED ASYNC RECORDING EVENT HANDLER
    // Stringee posts recording URLs after the call session ends.
    // ------------------------------------------------------------------------
    if (rawEventType.includes("record") || finalRecordingUrl) {
      if (finalRecordingUrl) {
        await CallLog.findOneAndUpdate(
          { callId: call_id },
          { $set: { recordingUrl: finalRecordingUrl } },
          { upsert: true },
        );
        return res.status(200).json({ status: "recording_updated" });
      }
    }

    // ------------------------------------------------------------------------
    // 2. PARSE PHONE NUMBERS & METADATA
    // ------------------------------------------------------------------------
    const callerFrom =
      (typeof from === "object" ? from?.number : from) || "Unknown";
    const callerTo = (typeof to === "object" ? to?.number : to) || "Unknown";

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

    // Map Lead by destination phone number (last 10 digits match)
    let leadId: string | null = null;
    if (callerTo && callerTo !== "Unknown") {
      const cleanPhone = String(callerTo).slice(-10);
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

    // ------------------------------------------------------------------------
    // 3. COMPLETE CALL STATUS NORMALIZATION
    // Handles picked, unpicked, busy, rejected, and failed connections
    // ------------------------------------------------------------------------
    let normalizedStatus:
      | "started"
      | "answered"
      | "ended"
      | "missed"
      | "rejected"
      | "failed" = "started";

    const combinedReason = String(reason || "").toLowerCase();

    if (
      rawEventType.includes("ended") ||
      rawEventType.includes("completed") ||
      rawEventType.includes("hangup")
    ) {
      // If duration exists or call was answered, it ended naturally
      normalizedStatus = parseInt(duration || "0", 10) > 0 ? "ended" : "missed";
    } else if (
      rawEventType.includes("answered") ||
      rawEventType.includes("accept")
    ) {
      normalizedStatus = "answered";
    } else if (
      rawEventType.includes("busy") ||
      rawEventType.includes("user_busy") ||
      combinedReason.includes("busy")
    ) {
      normalizedStatus = "rejected";
    } else if (
      rawEventType.includes("no_answer") ||
      rawEventType.includes("missed") ||
      rawEventType.includes("timeout") ||
      combinedReason.includes("timeout") ||
      combinedReason.includes("no answer")
    ) {
      normalizedStatus = "missed";
    } else if (
      rawEventType.includes("reject") ||
      rawEventType.includes("cancel") ||
      combinedReason.includes("rejected")
    ) {
      normalizedStatus = "rejected";
    } else if (
      rawEventType.includes("failed") ||
      sip_code >= 400 ||
      combinedReason.includes("unallocated") ||
      combinedReason.includes("failed")
    ) {
      normalizedStatus = "failed";
    }

    // ------------------------------------------------------------------------
    // 4. UPSERT CALL LOG RECORD
    // ------------------------------------------------------------------------
    const updateData: any = {
      callStatus: normalizedStatus,
      fromNumber: String(callerFrom),
      toNumber: String(callerTo),
    };

    // Store duration (Ensure duration is 0 if call was not connected/answered)
    if (["missed", "rejected", "failed"].includes(normalizedStatus)) {
      updateData.duration = 0;
    } else if (duration !== undefined) {
      updateData.duration = parseInt(String(duration), 10) || 0;
    }

    if (finalRecordingUrl) updateData.recordingUrl = finalRecordingUrl;
    if (userId) updateData.caller = userId;
    if (branchId) updateData.branch = branchId;
    if (leadId) updateData.lead = leadId;

    const updatedLog = await CallLog.findOneAndUpdate(
      { callId: call_id },
      { $set: updateData },
      { upsert: true, returnDocument: "after" },
    );

    // ------------------------------------------------------------------------
    // 5. CREATE LEAD ACTIVITY RECORD
    // ------------------------------------------------------------------------
    if (
      leadId &&
      userId &&
      ["ended", "missed", "rejected"].includes(normalizedStatus)
    ) {
      const callDuration = updateData.duration || 0;
      let statusRemark = `Outbound call ${normalizedStatus}.`;
      if (normalizedStatus === "ended") {
        statusRemark = `Outbound call ended. Duration: ${callDuration}s`;
      } else if (normalizedStatus === "missed") {
        statusRemark = `Outbound call unanswered (No answer / Timeout).`;
      } else if (normalizedStatus === "rejected") {
        statusRemark = `Outbound call rejected (Line busy).`;
      }

      await createLeadActivity({
        leadId,
        activityType: "call_logged",
        performedBy: userId,
        remark: statusRemark,
        metadata: {
          callId: call_id,
          recordingUrl: updatedLog?.recordingUrl || finalRecordingUrl,
          branchId,
          status: normalizedStatus,
          duration: callDuration,
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

    if (req.user?.role !== "head") {
      query.caller = req.user?.id;
    } else if (req.user?.branches) {
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

export const getCallLogs = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const skip = (page - 1) * limit;

    const { status, leadId, userId, branchId, search, startDate, endDate } =
      req.query;

    const filter: any = {};

    const toObjectId = (value: unknown): unknown => {
      const raw = String(value);
      return Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : value;
    };

    if (req.user?.role !== "head") {
      filter.caller = toObjectId(req.user?.id);
    } else {
      if (userId) filter.caller = toObjectId(userId);
      if (branchId) filter.branch = toObjectId(branchId);
    }

    if (status) filter.callStatus = status;
    if (leadId) filter.lead = toObjectId(leadId);

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");

      const matchedLeads = await Lead.find({
        $or: [{ name: searchRegex }, { phone: searchRegex }],
        isDeleted: { $ne: true },
      })
        .select("_id")
        .lean();

      const matchedUsers = await User.find({
        name: searchRegex,
      })
        .select("_id")
        .lean();

      const leadIds = matchedLeads.map((l) => l._id);
      const userIds = matchedUsers.map((u) => u._id);

      filter.$or = [
        { toNumber: searchRegex },
        { fromNumber: searchRegex },
        ...(leadIds.length > 0 ? [{ lead: { $in: leadIds } }] : []),
        ...(userIds.length > 0 ? [{ caller: { $in: userIds } }] : []),
      ];
    }

    const [logs, total, summary] = await Promise.all([
      CallLog.find(filter)
        .populate("lead", "name phone email company avatar")
        .populate("caller", "name email avatar")
        .populate("branch", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CallLog.countDocuments(filter),
      CallLog.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            totalSeconds: { $sum: { $ifNull: ["$duration", 0] } },
            answeredCalls: {
              $sum: {
                $cond: [{ $in: ["$callStatus", ["answered", "ended"]] }, 1, 0],
              },
            },
            missedCalls: {
              $sum: {
                $cond: [
                  { $in: ["$callStatus", ["missed", "rejected", "failed"]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const stats = {
      totalCalls: summary[0]?.totalCalls ?? 0,
      totalSeconds: summary[0]?.totalSeconds ?? 0,
      answeredCalls: summary[0]?.answeredCalls ?? 0,
      missedCalls: summary[0]?.missedCalls ?? 0,
    };

    return res.status(200).json({
      success: true,
      data: logs,
      stats,
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
