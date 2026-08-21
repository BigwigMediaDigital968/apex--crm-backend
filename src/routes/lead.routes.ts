import { Router } from "express";

import {
  createLeadController,
  getLeadCallLogs,
  listLeadsController,
  getLeadController,
  // assignLeadController,
  updateLeadStatusController,
  addLeadRemarkController,
  getLeadActivitiesController,
} from "../controllers/lead.controller.js";

import {
  createLeadFollowUpController,
  completeLeadFollowUpController,
  getLeadFollowUpsController,
  getMyPendingFollowUpsController,
} from "../controllers/lead-followup.controller.js";

import { assignLeadController, bulkAssignLeadsController } from "../controllers/lead-assignment.controller.js";

import { importLeadsController } from "../controllers/lead-import.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import { authorize } from "../middleware/authorize.middleware.js";

import { PERMISSIONS } from "../constants/permissions.js";
import { leadExcelUpload } from "../middleware/upload.middleware.js";
import { requireBranchAccess } from "../middleware/branch.middleware.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.LEAD_CREATE),
  createLeadController,
);

router.get("/:leadId/calls", authenticate, getLeadCallLogs);

router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.LEAD_VIEW),
  listLeadsController,
);

router.get(
  "/my/follow-ups",
  authenticate,
  authorize(PERMISSIONS.LEAD_VIEW),
  getMyPendingFollowUpsController,
);

router.post(
  "/:id/follow-ups",
  authenticate,
  authorize(PERMISSIONS.LEAD_UPDATE),
  createLeadFollowUpController,
);

router.get(
  "/:id/follow-ups",
  authenticate,
  authorize(PERMISSIONS.LEAD_VIEW),
  getLeadFollowUpsController,
);

router.get(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.LEAD_VIEW),
  getLeadController,
);

router.patch(
  "/:id/assign",
  authenticate,
  authorize(PERMISSIONS.LEAD_ASSIGN),
  assignLeadController,
);

// Bulk lead assignment
router.patch(
  "/bulk-assign",
  authenticate,
  authorize(PERMISSIONS.LEAD_ASSIGN),
  bulkAssignLeadsController,
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(PERMISSIONS.LEAD_UPDATE),
  updateLeadStatusController,
);

router.post(
  "/:id/remarks",
  authenticate,
  authorize(PERMISSIONS.LEAD_UPDATE),
  addLeadRemarkController,
);

router.get(
  "/:id/activities",
  authenticate,
  authorize(PERMISSIONS.LEAD_VIEW),
  getLeadActivitiesController,
);

router.post(
  "/import",
  authenticate,
  authorize(PERMISSIONS.LEAD_CREATE),
  leadExcelUpload.single("file"), // 1. Parse the file & form-data fields first
  requireBranchAccess((req) =>
    typeof req.body?.branchId === "string" // 2. Now req.body.branchId is accessible!
      ? req.body.branchId
      : undefined,
  ),
  importLeadsController,
);

router.patch(
  "/follow-ups/:followUpId/complete",
  authenticate,
  authorize(PERMISSIONS.LEAD_UPDATE),
  completeLeadFollowUpController,
);

export default router;
