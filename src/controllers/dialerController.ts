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
  // Read params from GET query or POST body
  const rawFrom = req.query.from || req.body.from || "";
  const rawTo = req.query.to || req.body.to || "";
  const customData =
    req.query.custom_data ||
    req.body.custom_data ||
    req.query.customData ||
    req.body.customData ||
    "";

  const cleanTo = String(rawTo).replace(/[^\d+]/g, "");
  const rawHotline = process.env.STRINGEE_HOTLINE_NUMBER || "917971730788";
  const cleanHotline = String(rawHotline).replace(/[^\d+]/g, "");

  // Correct SCCO payload format expected by Stringee Voice SDK
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
};

export const handleCallEventsWebhook = async (req: Request, res: Response) => {
  try {
    const { call_id, call_status, duration, record_url, custom_data } =
      req.body;
    let meta: any = {};

    try {
      meta = custom_data ? JSON.parse(custom_data) : {};
    } catch {
      meta = {};
    }

    // 1. Save or Update Call Log
    await CallLog.findOneAndUpdate(
      { callId: call_id },
      {
        $set: {
          callStatus: call_status,
          duration: duration || 0,
          recordingUrl: record_url,
          ...(meta.leadId && { lead: meta.leadId }),
          ...(meta.userId && { caller: meta.userId }),
          ...(meta.branchId && { branch: meta.branchId }),
        },
      },
      { upsert: true, new: true },
    );

    // 2. Create Lead Activity Log
    if (call_status === "ended" && meta.leadId && meta.userId) {
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
