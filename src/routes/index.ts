import { Router } from "express";
import branchRoutes from "./branch.routes";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes";
import permissionRoutes from "./permission.route.js";
import sessionRoutes from "./session.routes.js";
import auditRoutes from "./audit.routes.js";
import leadRoutes from "./lead.routes.js";
import taskRoutes from "./task.routes.js";
import employeeRoutes from "./employee.routes.js";
import holidayRoutes from "./holiday.routes.js";

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
router.use("/tasks", taskRoutes);
router.use("/employee", employeeRoutes);
router.use("/holidays", holidayRoutes);

export default router;
