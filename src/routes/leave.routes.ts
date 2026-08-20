import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";

import { PERMISSIONS } from "../constants/permissions.js";

import {
  createLeaveRequestController,
  getLeaveRequestController,
  listLeaveRequestsController,
  updateLeaveRequestController,
  cancelLeaveRequestController,
  approveLeaveRequestController,
  rejectLeaveRequestController,
} from "../controllers/leave.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.LEAVE_CREATE),
  createLeaveRequestController,
);

router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.LEAVE_VIEW),
  listLeaveRequestsController,
);

router.get(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.LEAVE_VIEW),
  getLeaveRequestController,
);

router.patch(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.LEAVE_UPDATE),
  updateLeaveRequestController,
);

router.post(
  "/:id/cancel",
  authenticate,
  authorize(PERMISSIONS.LEAVE_CANCEL),
  cancelLeaveRequestController,
);

router.post(
  "/:id/approve",
  authenticate,
  authorize(PERMISSIONS.LEAVE_APPROVE),
  approveLeaveRequestController,
);

router.post(
  "/:id/reject",
  authenticate,
  authorize(PERMISSIONS.LEAVE_REJECT),
  rejectLeaveRequestController,
);

export default router;
