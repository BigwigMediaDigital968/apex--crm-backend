import { Router } from "express";

import {
  loginController,
  logoutController,
  getMeController,
  refreshController,
} from "../controllers/auth.controller.js";

import {
  authenticate,
} from "../middleware/auth.middleware.js";

import {
  authorize,
} from "../middleware/authorize.middleware.js";

import {
  PERMISSIONS,
} from "../constants/permissions.js";

const router =
  Router();

router.post(
  "/login",
  loginController,
);

router.post(
  "/refresh",
  refreshController,
);

router.post(
  "/logout",
  authenticate,
  logoutController,
);

router.get(
  "/me",
  authenticate,
  getMeController,
);

router.get(
  "/test-branch-permission",
  authenticate,
  authorize(
    PERMISSIONS.BRANCH_CREATE,
  ),
  (_req, res) => {
    res.json({
      success: true,
      message:
        "You have branch creation permission",
    });
  },
);

export default router;