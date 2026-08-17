import { Router } from "express";
import {
  createTaskController,
  getTasksController,
  getTaskByIdController,
  updateTaskController,
  getTaskActivitiesController,
} from "../controllers/task.controller.js";
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

router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.TASK_VIEW),
  getTasksController,
);

router.get(
  "/:id/activities",
  authenticate,
  authorize(PERMISSIONS.TASK_VIEW),
  getTaskActivitiesController,
);

router.get(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.TASK_VIEW),
  getTaskByIdController,
);

router.patch(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.TASK_UPDATE),
  updateTaskController,
);

export default router;
