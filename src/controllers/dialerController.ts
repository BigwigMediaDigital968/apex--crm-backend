// src/controllers/dialer.controller.ts
import { Request, Response } from "express";
import { generateStringeeToken } from "../utils/stringeeToken.js";
import { CallLog } from "../models/CallLog.js";
import { Lead } from "../models/Lead.js";
import { createLeadActivity } from "../services/lead.service.js";

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
    // Safely fallback to empty objects if req.body or req.query are undefined
    const body = req.body || {};
    const query = req.query || {};

    // Stringee passes incoming call payload in query (GET) or body (POST)
    const rawFrom = query.from || body.from || "";
    const rawTo = query.to || body.to || "";
    const customData =
      query.custom_data ||
      body.custom_data ||
      query.customData ||
      body.customData ||
      "";

    const cleanTo = String(rawTo).replace(/[^\d+]/g, "");
    const rawHotline = process.env.STRINGEE_HOTLINE_NUMBER || "917971730788";
    const cleanHotline = String(rawHotline).replace(/[^\d+]/g, "");

    // SCCO payload for Stringee Programmable Voice
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
        customData:
          typeof customData === "object"
            ? JSON.stringify(customData)
            : String(customData),
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
      duration,
      record_url,
      custom_data,
      from_number,
      to_number,
      from,
      to,
    } = req.body;

    let meta: any = {};
    if (custom_data) {
      try {
        meta = typeof custom_data === "string" ? JSON.parse(custom_data) : custom_data;
      } catch {
        meta = {};
      }
    }

    const callerFrom = from_number || from || meta.fromNumber || "Unknown";
    const callerTo = to_number || to || meta.toNumber || "Unknown";

    // Normalize call status to fit Mongoose Schema enum
    let normalizedStatus: "started" | "answered" | "ended" | "missed" | "rejected" = "started";
    if (call_status === "ended") normalizedStatus = "ended";
    else if (call_status === "answered") normalizedStatus = "answered";
    else if (call_status === "busy" || call_status === "rejected") normalizedStatus = "rejected";
    else if (call_status === "no_answer") normalizedStatus = "missed";

    // 1. Save or Update Call Log
    if (call_id) {
      await CallLog.findOneAndUpdate(
        { callId: call_id },
        {
          $set: {
            callStatus: normalizedStatus,
            duration: duration || 0,
            fromNumber: callerFrom,
            toNumber: callerTo,
            ...(record_url && { recordingUrl: record_url }),
            ...(meta.leadId && { lead: meta.leadId }),
            ...(meta.userId && { caller: meta.userId }),
            ...(meta.branchId && { branch: meta.branchId }),
          },
        },
        { upsert: true, new: true }
      );
    }

    // 2. Create Lead Activity Log
    if (normalizedStatus === "ended" && meta.leadId && meta.userId) {
      await createLeadActivity({
        leadId: meta.leadId,
        activityType: "call_logged",
        performedBy: meta.userId,
        remark: `Outbound call ended. Duration: ${duration || 0}s`,
        metadata: {
          callId: call_id,
          recordingUrl: record_url,
          branchId: meta.branchId,
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
      query.branch = req.user?.branches;
    }

    const calls = await CallLog.find(query)
      .populate("caller", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: calls });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};


// src/controllers/dialerController.ts
// import { Request, Response } from "express";
// import { generateStringeeToken } from "../utils/stringeeToken.js";
// import { CallLog } from "../models/CallLog.js";
// import { Lead } from "../models/Lead.js";
// import { createLeadActivity } from "../services/lead.service.js";

// export const getStringeeTokenController = async (req: Request, res: Response) => {
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

//     const rawFrom = query.from || body.from || "";
//     const rawTo = query.to || body.to || "";
//     const customDataRaw =
//       query.custom_data || body.custom_data || query.customData || body.customData || "";

//     const cleanTo = String(rawTo).replace(/[^\d+]/g, "");
//     const rawHotline = process.env.STRINGEE_HOTLINE_NUMBER || "917971730788";
//     const cleanHotline = String(rawHotline).startsWith("+")
//       ? String(rawHotline)
//       : `+${String(rawHotline).replace(/[^\d]/g, "")}`;

//     // Ensure customData retains metadata string for Stringee state transfer
//     const formattedCustomData =
//       typeof customDataRaw === "object" ? JSON.stringify(customDataRaw) : String(customDataRaw);

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
//         customData: formattedCustomData,
//         timeout: 45,
//         record: true,
//       },
//     ];

//     res.setHeader("Content-Type", "application/json");
//     return res.status(200).json(scco);
//   } catch (error: any) {
//     console.error("[Stringee Answer Webhook Error]:", error);
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
//       start_time,
//       answer_time,
//       call_created_reason,
//     } = req.body;

//     if (!call_id) {
//       return res.status(200).json({ status: "ignored_no_call_id" });
//     }

//     // Safely parse metadata passed from WebRTC client
//     let meta: any = {};
//     if (custom_data) {
//       try {
//         meta = typeof custom_data === "string" ? JSON.parse(custom_data) : custom_data;
//       } catch {
//         meta = {};
//       }
//     }

//     const callerFrom = from_number || from || meta.fromNumber || "917971730788";
//     const callerTo = to_number || to || meta.toNumber || "";

//     // Map Stringee status codes to CRM Call Status
//     let normalizedStatus: "started" | "answered" | "ended" | "missed" | "rejected" = "started";
//     if (call_status === "ended") normalizedStatus = "ended";
//     else if (call_status === "answered") normalizedStatus = "answered";
//     else if (call_status === "busy" || call_status === "rejected") normalizedStatus = "rejected";
//     else if (call_status === "no_answer") normalizedStatus = "missed";

//     // Build Mongo update payload
//     const updateData: Record<string, any> = {
//       callStatus: normalizedStatus,
//       duration: Number(duration) || 0,
//       fromNumber: callerFrom,
//       toNumber: callerTo,
//     };

//     if (record_url) updateData.recordingUrl = record_url;
//     if (start_time) updateData.startTime = new Date(Number(start_time));
//     if (answer_time) updateData.answerTime = new Date(Number(answer_time));
//     if (meta.leadId) updateData.lead = meta.leadId;
//     if (meta.userId) updateData.caller = meta.userId;
//     if (meta.branchId) updateData.branch = meta.branchId;

//     // 1. Upsert Call Log Record
//     const updatedCallLog = await CallLog.findOneAndUpdate(
//       { callId: call_id },
//       { $set: updateData },
//       { upsert: true, new: true }
//     );

//     // 2. Attach Call Activity directly inside the Lead timeline
//     if (normalizedStatus === "ended" && meta.leadId) {
//       const activityRemark = `Outbound call completed. Duration: ${duration || 0} seconds.`;

//       if (meta.userId) {
//         await createLeadActivity({
//           leadId: meta.leadId,
//           activityType: "call_logged",
//           performedBy: meta.userId,
//           remark: activityRemark,
//           metadata: {
//             callId: call_id,
//             recordingUrl: record_url || "",
//             duration: duration || 0,
//             fromNumber: callerFrom,
//             toNumber: callerTo,
//             status: normalizedStatus,
//           },
//         });
//       }

//       // Also update overall status on the Lead document directly if required
//       await Lead.findByIdAndUpdate(meta.leadId, {
//         $set: {
//           lastContactedAt: new Date(),
//           lastCallStatus: normalizedStatus,
//         },
//       });
//     }

//     return res.status(200).json({ status: "success", logId: updatedCallLog._id });
//   } catch (error: any) {
//     console.error("[Call Event Error]:", error);
//     return res.status(500).json({ message: error.message });
//   }
// };

// export const getLeadCallHistoryController = async (req: Request, res: Response) => {
//   try {
//     const { leadId } = req.params;

//     const lead = await Lead.findById(leadId);
//     if (!lead || lead.isDeleted) {
//       return res.status(404).json({ message: "Lead not found" });
//     }

//     const query: any = { lead: leadId };

//     if (req.user?.role !== "head" && req.user?.branches) {
//       query.branch = { $in: req.user.branches };
//     }

//     const calls = await CallLog.find(query)
//       .populate("caller", "name email role")
//       .populate("branch", "name")
//       .sort({ createdAt: -1 });

//     return res.status(200).json({ success: true, data: calls });
//   } catch (error: any) {
//     return res.status(500).json({ message: error.message });
//   }
// };