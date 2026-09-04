// import { Router } from "express";

// import {
//   loginController,
//   logoutController,
//   getMeController,
//   refreshController,
// } from "../controllers/auth.controller.js";

// import {
//   authenticate,
// } from "../middleware/auth.middleware.js";

// import {
//   authorize,
// } from "../middleware/authorize.middleware.js";

// import {
//   PERMISSIONS,
// } from "../constants/permissions.js";

// const router =
//   Router();

// router.post(
//   "/login",
//   loginController,
// );

// router.post(
//   "/refresh",
//   refreshController,
// );

// router.post(
//   "/logout",
//   authenticate,
//   logoutController,
// );

// router.get(
//   "/me",
//   authenticate,
//   getMeController,
// );

// router.get(
//   "/test-branch-permission",
//   authenticate,
//   authorize(
//     PERMISSIONS.BRANCH_CREATE,
//   ),
//   (_req, res) => {
//     res.json({
//       success: true,
//       message:
//         "You have branch creation permission",
//     });
//   },
// );

// export default router;

import { Router } from "express";
import {
  loginController,
  logoutController,
  getMeController,
  refreshController,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { trackActivity } from "../middleware/auditLogger.middleware.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

// 1. User Login
router.post(
  "/login",
  trackActivity("USER", "LOGIN", (req) => {
    return `User logged into system (${req.body?.email || "Unknown Email"})`;
  }),
  loginController,
);

// 2. Refresh Token (No tracking needed)
router.post("/refresh", refreshController);

// 3. User Logout
router.post(
  "/logout",
  authenticate,
  trackActivity("USER", "LOGOUT", (req) => {
    const user = (req as any).user;
    return `User ${user?.name || user?.email || ""} logged out`;
  }),
  logoutController,
);

// Read-only / Test Routes (No tracking needed)
router.get("/me", authenticate, getMeController);

router.get(
  "/test-branch-permission",
  authenticate,
  authorize(PERMISSIONS.BRANCH_CREATE),
  (_req, res) => {
    res.json({
      success: true,
      message: "You have branch creation permission",
    });
  },
);

export default router;
