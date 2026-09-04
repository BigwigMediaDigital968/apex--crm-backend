// import { Router } from "express";
// import { authenticate } from "../middleware/auth.middleware.js";
// import { authorize } from "../middleware/authorize.middleware.js";
// import { PERMISSIONS } from "../constants/permissions.js";
// import {
//   LateCheckInRequest,
//   LATE_CHECKIN_STATUS,
// } from "../models/LateCheckInRequest.js";
// import {
//   submitLateCheckInReason,
//   reviewLateCheckIn,
// } from "../services/lateCheckIn.service.js";
// import { ROLE_PERMISSIONS } from "../permissions/rolePermissions.js";

// const router = Router();

// // Submit late check-in reason (Public endpoint for unauthenticated blocked logins)
// router.post("/submit-reason", async (req, res, next) => {
//   try {
//     const { userId, reason } = req.body;

//     if (!userId || !reason) {
//       return res.status(400).json({
//         success: false,
//         message: "User ID and reason are required",
//       });
//     }

//     const request = await submitLateCheckInReason(userId, reason);
//     return res.status(201).json({
//       success: true,
//       message: "Reason submitted successfully. Awaiting approval.",
//       data: request,
//     });
//   } catch (err) {
//     next(err);
//   }
// });

// // GET Requests list (Scoped by permission)
// router.get("/", authenticate, async (req, res, next) => {
//   try {
//     const { status } = req.query;
//     const user = req.user!;
//     const queryFilter: Record<string, any> = {};

//     if (typeof status === "string" && status.trim() !== "") {
//       queryFilter.status = status;
//     }

//     const userPermissions = ROLE_PERMISSIONS[user.role] || [];
//     const canApprove =
//       userPermissions.includes(PERMISSIONS.LATE_CHECKIN_APPROVE) ||
//       userPermissions.includes(PERMISSIONS.ATTENDANCE_MANAGE);

//     // Employees only view their own requests using user.id
//     if (!canApprove) {
//       queryFilter.employee = user.id;
//     }

//     const requests = await LateCheckInRequest.find(queryFilter)
//       .populate("employee", "name email role branch")
//       .populate("reviewedBy", "name email")
//       .sort({ createdAt: -1 })
//       .lean();

//     return res.status(200).json({
//       success: true,
//       data: requests,
//     });
//   } catch (err) {
//     next(err);
//   }
// });

// // PATCH Review request (Approve / Reject)
// router.patch(
//   "/:id/review",
//   authenticate,
//   authorize(PERMISSIONS.LATE_CHECKIN_APPROVE),
//   async (req, res, next) => {
//     try {
//       const { id } = req.params;
//       const { status, remarks } = req.body;

//       if (!id || typeof id !== "string") {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid or missing request ID",
//         });
//       }

//       if (
//         status !== LATE_CHECKIN_STATUS.APPROVED &&
//         status !== LATE_CHECKIN_STATUS.REJECTED
//       ) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid status value",
//         });
//       }

//       const request = await reviewLateCheckIn(req.user!, id, status, remarks);
//       return res.status(200).json({
//         success: true,
//         message: `Late check-in request ${status.toLowerCase()} successfully`,
//         data: request,
//       });
//     } catch (err) {
//       next(err);
//     }
//   }
// );

// export default router;

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { trackActivity } from "../middleware/auditLogger.middleware.js";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  LateCheckInRequest,
  LATE_CHECKIN_STATUS,
} from "../models/LateCheckInRequest.js";
import {
  submitLateCheckInReason,
  reviewLateCheckIn,
} from "../services/lateCheckIn.service.js";
import { ROLE_PERMISSIONS } from "../permissions/rolePermissions.js";

const router = Router();

// 1. SUBMIT LATE CHECK-IN REASON
router.post(
  "/submit-reason",
  (req, _res, next) => {
    // Explicitly seed req.user so trackActivity gets the correct performing user ID
    if (req.body?.userId) {
      (req as any).user = { _id: req.body.userId };
    }
    next();
  },
  trackActivity(
    "ATTENDANCE",
    "LATE_CHECKIN_SUBMITTED",
    (req) =>
      `Submitted late check-in reason: "${req.body?.reason || "No reason provided"}"`,
  ),
  async (req, res, next) => {
    try {
      const { userId, reason } = req.body;

      if (!userId || !reason) {
        return res.status(400).json({
          success: false,
          message: "User ID and reason are required",
        });
      }

      const request = await submitLateCheckInReason(userId, reason);
      return res.status(201).json({
        success: true,
        message: "Reason submitted successfully. Awaiting approval.",
        data: request,
      });
    } catch (err) {
      next(err);
    }
  },
);

// 2. GET REQUESTS LIST (Read-only)
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { status } = req.query;
    const user = req.user!;
    const queryFilter: Record<string, any> = {};

    if (typeof status === "string" && status.trim() !== "") {
      queryFilter.status = status;
    }

    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    const canApprove =
      userPermissions.includes(PERMISSIONS.LATE_CHECKIN_APPROVE) ||
      userPermissions.includes(PERMISSIONS.ATTENDANCE_MANAGE);

    if (!canApprove) {
      queryFilter.employee = user.id;
    }

    const requests = await LateCheckInRequest.find(queryFilter)
      .populate("employee", "name email role branch")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
});

// 3. REVIEW LATE CHECK-IN REQUEST (Approve / Reject)
router.patch(
  "/:id/review",
  authenticate,
  authorize(PERMISSIONS.LATE_CHECKIN_APPROVE),
  trackActivity(
    "ATTENDANCE",
    "LATE_CHECKIN_APPROVED",
    (req) =>
      `Reviewed late check-in request (ID: ${req.params.id}) as ${req.body?.status}`,
  ),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;

      if (!id || typeof id !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid or missing request ID",
        });
      }

      if (
        status !== LATE_CHECKIN_STATUS.APPROVED &&
        status !== LATE_CHECKIN_STATUS.REJECTED
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        });
      }

      const request = await reviewLateCheckIn(req.user!, id, status, remarks);
      return res.status(200).json({
        success: true,
        message: `Late check-in request ${status.toLowerCase()} successfully`,
        data: request,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
