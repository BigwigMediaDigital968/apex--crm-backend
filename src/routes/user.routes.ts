import { Router } from "express";

import {
  createUserController,
  getUsersController,
  updateUserBranchesController,
  updateUserController,
  updateUserStatusController,
  getUserByIdController,
} from "../controllers/user.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import { authorize } from "../middleware/authorize.middleware.js";

import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.USER_VIEW),
  getUsersController,
);

router.get(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.USER_VIEW),
  getUserByIdController,
);

router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.USER_CREATE),
  createUserController,
);

router.patch(
  "/:id/branches",
  authenticate,
  authorize(PERMISSIONS.USER_ASSIGN_BRANCH),
  updateUserBranchesController,
);

router.patch(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.USER_UPDATE),
  updateUserController,
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(PERMISSIONS.USER_STATUS_UPDATE),
  updateUserStatusController,
);

export default router;
