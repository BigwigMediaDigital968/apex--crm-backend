import { Router } from "express";

import {
  createHolidayController,
  getBranchHolidaysController,
  updateHolidayController,
  deleteHolidayController,
} from "../controllers/holiday.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import { authorize } from "../middleware/authorize.middleware.js";

import { requireBranchAccess } from "../middleware/branch.middleware.js";

import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.HOLIDAY_CREATE),
  requireBranchAccess((req) =>
    typeof req.body?.branchId === "string" ? req.body.branchId : undefined,
  ),
  createHolidayController,
);

router.get(
  "/branch/:branchId",
  authenticate,
  authorize(PERMISSIONS.HOLIDAY_VIEW),
  requireBranchAccess((req) =>
    typeof req.params.branchId === "string" ? req.params.branchId : undefined,
  ),
  getBranchHolidaysController,
);

router.patch(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.HOLIDAY_UPDATE),
  updateHolidayController,
);

router.delete(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.HOLIDAY_DELETE),
  deleteHolidayController,
);

export default router;
