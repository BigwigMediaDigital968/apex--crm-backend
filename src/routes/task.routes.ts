import { Router } from "express";

import { createTaskController } from "../controllers/task.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

import { authorize } from "../middleware/authorize.middleware.js";

import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.TASK_CREATE),
  createTaskController,
);

export default router;
