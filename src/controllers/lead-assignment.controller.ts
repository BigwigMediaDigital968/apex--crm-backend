import type {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  assignLead,
} from "../services/lead-assignment.service.js";

import {
  assignLeadSchema,
} from "../validators/lead-assignment.validator.js";

import {
  createAuditLog,
} from "../services/audit.service.js";

export const assignLeadController =
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
          code:
            "AUTHENTICATION_REQUIRED",
        });
      }

      const data =
        assignLeadSchema.parse(
          req.body,
        );

      const leadId =
        typeof req.params.id ===
        "string"
          ? req.params.id
          : undefined;

      if (!leadId) {
        return res.status(400).json({
          success: false,
          message:
            "Lead ID is required",
          code:
            "LEAD_ID_REQUIRED",
        });
      }

      const lead =
        await assignLead({
          leadId,
          employeeId:
            data.employeeId,
          actorId:
            req.user.id,
        });

      await createAuditLog({
        actor:
          req.user.id,

        action:
          "LEAD_ASSIGNED",

        entity:
          "Lead",

        entityId:
          lead._id.toString(),

        branch:
          lead.branch.toString(),

        metadata: {
          assignedTo:
            data.employeeId,

          assignedAt:
            lead.assignedAt,
        },

        ipAddress:
          req.ip,

        userAgent:
          req.get(
            "user-agent",
          ),
      });

      return res.status(200).json({
        success: true,

        message:
          "Lead assigned successfully",

        data: {
          lead,
        },
      });
    } catch (error) {
      next(error);
    }
  };