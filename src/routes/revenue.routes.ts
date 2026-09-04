// // src/routes/revenue.routes.ts
// import { Router } from "express";
// import { authenticate } from "../middleware/auth.middleware.js";
// import { authorize } from "../middleware/authorize.middleware.js";
// import { PERMISSIONS } from "../constants/permissions.js";
// import {
//   createRevenueHandler,
//   getRevenueReportHandler,
//   updateRevenueStatusHandler,
//   getTotalRevenueHandler,
// } from "../controllers/revenue.controller.js";

// const router = Router();

// router.use(authenticate);

// // Create Revenue Entry
// router.post("/", authorize(PERMISSIONS.REVENUE_CREATE), createRevenueHandler);

// router.get(
//   "/total",
//   authorize(PERMISSIONS.REVENUE_VIEW),
//   getTotalRevenueHandler,
// );

// // View Flexible Revenue Reports (Supports viewMode = INDIVIDUAL | TEAM | BRANCH | LEAD)
// router.get(
//   "/report",
//   authorize(PERMISSIONS.REVENUE_VIEW),
//   getRevenueReportHandler,
// );

// // Admin / Head Verification API
// router.patch(
//   "/:id/status",
//   authorize(PERMISSIONS.REVENUE_MANAGE),
//   updateRevenueStatusHandler,
// );

// export default router;

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { trackActivity } from "../middleware/auditLogger.middleware.js";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  createRevenueHandler,
  getRevenueReportHandler,
  updateRevenueStatusHandler,
  getTotalRevenueHandler,
} from "../controllers/revenue.controller.js";

const router = Router();

router.use(authenticate);

// 1. CREATE REVENUE ENTRY
router.post(
  "/",
  authorize(PERMISSIONS.REVENUE_CREATE),
  trackActivity(
    "REVENUE",
    "CREATED",
    (req) => `Created revenue entry of amount: ${req.body?.amount || 0}`,
  ),
  createRevenueHandler,
);

// 2. READ / REPORT ENDPOINTS (Read-only)
router.get(
  "/total",
  authorize(PERMISSIONS.REVENUE_VIEW),
  getTotalRevenueHandler,
);

router.get(
  "/report",
  authorize(PERMISSIONS.REVENUE_VIEW),
  getRevenueReportHandler,
);

// 3. VERIFY / UPDATE REVENUE STATUS
router.patch(
  "/:id/status",
  authorize(PERMISSIONS.REVENUE_MANAGE),
  trackActivity(
    "REVENUE",
    "VERIFIED",
    (req) =>
      `Updated status for revenue entry ID ${req.params.id} to '${req.body?.status}'`,
  ),
  updateRevenueStatusHandler,
);

export default router;
