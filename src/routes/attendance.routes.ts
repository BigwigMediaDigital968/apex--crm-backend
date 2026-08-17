import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";

import {
  checkInController,
  checkOutController,
  getAttendanceController,
  getAttendanceReportController,
} from "../controllers/attendance.controller.js";

import { authorize } from "../middleware/authorize.middleware.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.post(
  "/check-in",
  authenticate,
  authorize(PERMISSIONS.ATTENDANCE_CHECK_IN),
  checkInController,
);

router.post(
  "/check-out",
  authenticate,
  authorize(PERMISSIONS.ATTENDANCE_CHECK_OUT),
  checkOutController,
);

router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.ATTENDANCE_VIEW),
  getAttendanceController,
);

router.get(
  "/reports/summary",
  authenticate,
  authorize(PERMISSIONS.ATTENDANCE_REPORT),
  getAttendanceReportController,
);

export default router;
