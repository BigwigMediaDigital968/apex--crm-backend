import { Router } from "express";

import {
  createLeadController,
  listLeadsController,
  getLeadController,
  assignLeadController,
  updateLeadStatusController,
  addLeadRemarkController,
  getLeadActivitiesController,
} from "../controllers/lead.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import { authorize } from "../middleware/authorize.middleware.js";

import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.LEAD_CREATE),
  createLeadController,
);

router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.LEAD_VIEW),
  listLeadsController,
);

router.get(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.LEAD_VIEW),
  getLeadController,
);

router.post(
  "/:id/assign",
  authenticate,
  authorize(PERMISSIONS.LEAD_ASSIGN),
  assignLeadController,
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(
    PERMISSIONS.LEAD_UPDATE,
  ),
  updateLeadStatusController,
);

router.post(
  "/:id/remarks",
  authenticate,
  authorize(
    PERMISSIONS.LEAD_UPDATE,
  ),
  addLeadRemarkController,
);

router.get(
  "/:id/activities",
  authenticate,
  authorize(
    PERMISSIONS.LEAD_VIEW,
  ),
  getLeadActivitiesController,
);

export default router;
