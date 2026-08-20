import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";

import { PERMISSIONS } from "../constants/permissions.js";

import {
  createLeavePolicyController,
  listLeavePoliciesController,
  getLeavePolicyController,
  updateLeavePolicyController,
  deactivateLeavePolicyController,
} from "../controllers/leave-policy.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.LEAVE_POLICY_CREATE),
  createLeavePolicyController,
);

router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.LEAVE_POLICY_VIEW),
  listLeavePoliciesController,
);

router.get(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.LEAVE_POLICY_VIEW),
  getLeavePolicyController,
);

router.patch(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.LEAVE_POLICY_UPDATE),
  updateLeavePolicyController,
);

router.patch(
  "/:id/deactivate",
  authenticate,
  authorize(PERMISSIONS.LEAVE_POLICY_UPDATE),
  deactivateLeavePolicyController,
);

export default router;
