import { Request, Response, NextFunction } from "express";
import { logActivity } from "../services/activity.service.js";

// Quick sanity update in src/middleware/auditLogger.middleware.ts
export const trackActivity = (
  module:
    | "LEAD"
    | "LEAD_ACTIVITY"
    | "LEAD_FOLLOWUP"
    | "CALL_LOG"
    | "BRANCH"
    | "HOLIDAY"
    | "USER"
    | "EMPLOYEE"
    | "STRINGEE"
    | "TASK"
    | "ATTENDANCE"
    | "LEAVE"
    | "REVENUE"
    | "SYSTEM",
  action: string,
  getDescription?: (req: Request) => string,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const currentUser = (req as any).user;

        // Ensure userId is present (for login, it gets populated on req.user inside loginController)
        const userId = currentUser?._id || currentUser?.id;
        if (!userId) return;

        logActivity({
          module,
          action,
          description: getDescription
            ? getDescription(req)
            : `${action} on ${req.originalUrl}`,
          performedBy: userId,
          branch: currentUser?.branches?.[0],
          ipAddress: req.ip,
          metadata: { ip: req.ip, userAgent: req.get("user-agent") },
        });
      }
    });

    next();
  };
};
