import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";

import { PERMISSIONS } from "../constants/permissions.js";

import {
  getLeaveBalancesController,
  getEmployeeLeaveBalancesController,
  getLeaveBalanceTransactionsController,
  adjustLeaveBalanceController,
  allocateLeaveBalanceController,
} from "../controllers/leave-balance.controller.js";

const router = Router();

router.post(
  "/allocate",
  authenticate,
  authorize(PERMISSIONS.LEAVE_BALANCE_MANAGE),
  allocateLeaveBalanceController,
);

router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.LEAVE_BALANCE_VIEW),
  getLeaveBalancesController,
);

router.get(
  "/:employeeId/transactions",
  authenticate,
  authorize(PERMISSIONS.LEAVE_BALANCE_TRANSACTION_VIEW),
  getLeaveBalanceTransactionsController,
);

router.post(
  "/:id/adjust",
  authenticate,
  authorize(PERMISSIONS.LEAVE_BALANCE_MANAGE),
  adjustLeaveBalanceController,
);

router.get(
  "/:employeeId",
  authenticate,
  authorize(PERMISSIONS.LEAVE_BALANCE_VIEW),
  getEmployeeLeaveBalancesController,
);

export default router;
