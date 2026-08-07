import { Router } from "express";

import {
  createBranchController,
  getBranchesController,
  updateBranchController,
  updateBranchStatusController,
} from "../controllers/branch.controller.js";

import {
  authenticate,
} from "../middleware/auth.middleware.js";

import {
  authorize,
} from "../middleware/authorize.middleware.js";

import {
  PERMISSIONS,
} from "../constants/permissions.js";

import {
  requireBranchAccess,
} from "../middleware/branch.middleware.js";

import {
  getRequiredParam,
} from "../utils/requestParams.js";

const router = Router();


// CREATE BRANCH
router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.BRANCH_CREATE),
  createBranchController,
);

// READ / LIST BRANCHES (👈 Added route)
router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.BRANCH_VIEW),
  getBranchesController,
);


// UPDATE BRANCH
router.patch(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.BRANCH_UPDATE),
  requireBranchAccess(
    (req) => getRequiredParam(req, "id"),
  ),
  updateBranchController,
);


// ACTIVATE / DEACTIVATE BRANCH
router.patch(
  "/:id/status",
  authenticate,
  authorize(PERMISSIONS.BRANCH_UPDATE),
  requireBranchAccess(
    (req) => getRequiredParam(req, "id"),
  ),
  updateBranchStatusController,
);


export default router;