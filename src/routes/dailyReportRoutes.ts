import { Router } from "express";
import {
  checkReportWindow,
  submitDailyReport,
  getMyDailyReports,
  getAllDailyReports,
  getDailyReportById,
} from "../controllers/dailyReportController.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { trackActivity } from "../middleware/auditLogger.middleware.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

// 1. CHECK SUBMISSION WINDOW AVAILABILITY (Any authenticated employee)
router.get(
  "/window",
  authenticate,
  checkReportWindow
);

// 2. SUBMIT DAILY REPORT (Employees)
router.post(
  "/",
  authenticate,
  authorize(PERMISSIONS.DAILY_REPORT_CREATE),
  trackActivity(
    "DAILY_REPORT",
    "CREATED",
    () => `Submitted daily activity report`
  ),
  submitDailyReport
);

// 3. READ LOGGED-IN EMPLOYEE'S REPORT HISTORY
router.get(
  "/my",
  authenticate,
  getMyDailyReports
);

// 4. READ / LIST ALL DAILY REPORTS (MANAGEMENT: Admin, Manager, Head)
router.get(
  "/",
  authenticate,
  authorize(PERMISSIONS.DAILY_REPORT_VIEW),
  getAllDailyReports
);

// 5. READ SINGLE DAILY REPORT BY ID (MANAGEMENT: Admin, Manager, Head)
router.get(
  "/:id",
  authenticate,
  authorize(PERMISSIONS.DAILY_REPORT_VIEW),
  getDailyReportById
);

export default router;