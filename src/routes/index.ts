import { Router } from "express";
import branchRoutes from "./branch.routes.js";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import permissionRoutes from "./permission.route.js";
import sessionRoutes from "./session.routes.js";
import auditRoutes from "./audit.routes.js";
import leadRoutes from "./lead.routes.js";
import taskRoutes from "./task.routes.js";
import employeeRoutes from "./employee.routes.js";
import holidayRoutes from "./holiday.routes.js";
import attendanceRoutes from "./attendance.routes.js";
import leavePolicyRoutes from "./leave-policy.routes.js";
import leaveRoutes from "./leave.routes.js";
import leaveBalanceRoutes from "./leave-balance.routes.js";
import dialerRoutes from "./dialer.routes.js";
import performanceRoutes from "./performance.routes.js";
import revenueRoutes from "./revenue.routes.js"
import contestRoutes from "./contest.routes.js"

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CRM API is healthy",
    timestamp: new Date().toISOString(),
  });
});

router.use("/branches", branchRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/permissions", permissionRoutes);
router.use("/sessions", sessionRoutes);
router.use("/audit-logs", auditRoutes);
router.use("/leads", leadRoutes);
router.use("/dialer", dialerRoutes);
router.use("/tasks", taskRoutes);
router.use("/employee", employeeRoutes);
router.use("/holidays", holidayRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/leave-policies", leavePolicyRoutes);
router.use("/leaves", leaveRoutes);
router.use("/leave-balances", leaveBalanceRoutes);
router.use("/performance", performanceRoutes);
router.use("/revenue", revenueRoutes);
router.use("/contest", contestRoutes);

export default router;
