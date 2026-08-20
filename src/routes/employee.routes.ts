import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";

import { authorize } from "../middleware/authorize.middleware.js";

import { PERMISSIONS } from "../constants/permissions.js";

import {
  createEmployeeController,
  getEmployeeController,
  listEmployeesController,
  updateEmployeeController,
} from "../controllers/employee.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.EMPLOYEE_CREATE),
  createEmployeeController,
);

router.patch(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.EMPLOYEE_UPDATE),
  updateEmployeeController,
);

router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.EMPLOYEE_VIEW),
  listEmployeesController,
);

router.get(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.EMPLOYEE_VIEW),
  getEmployeeController,
);

export default router;
