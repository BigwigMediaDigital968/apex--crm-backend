// // src/routes/dialer.routes.ts
// import { Router } from "express";
// import { authenticate } from "../middleware/auth.middleware.js";
// import { authorize } from "../middleware/authorize.middleware.js";
// import { PERMISSIONS } from "../constants/permissions.js";
// import {
//   getStringeeTokenController,
//   handleAnswerUrlWebhook,
//   handleCallEventsWebhook,
//   getLeadCallHistoryController,
//   getCallLogs,
//   getCallLogById,
// } from "../controllers/dialerController.js";

// const router = Router();

// // Secure route for logged-in users to start WebRTC calling session
// router.get(
//   "/token",
//   authenticate,
//   authorize(PERMISSIONS.CALL_INITIATE),
//   getStringeeTokenController,
// );

// // Secure route to fetch call logs for a lead
// router.get(
//   "/lead/:leadId",
//   authenticate,
//   authorize(PERMISSIONS.CALL_LOG_VIEW),
//   getLeadCallHistoryController,
// );

// // 2. Application REST Endpoints (Protected by App Auth)
// router.get("/logs", authenticate, authorize(PERMISSIONS.CALL_LOG_VIEW), getCallLogs);         // Supports ?limit=10 (for Dialer UI) & ?page=1 (for History UI)
// router.get("/logs/:id", authenticate, authorize(PERMISSIONS.CALL_LOG_VIEW), getCallLogById);   // Fetch single log details / audio stream link

// // Webhook routes (Public endpoints hit directly by Stringee servers)
// router
//   .route("/answer-url")
//   .get(handleAnswerUrlWebhook)
//   .post(handleAnswerUrlWebhook);

// router.post("/events", handleCallEventsWebhook);

// export default router;

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { trackActivity } from "../middleware/auditLogger.middleware.js";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  getStringeeTokenController,
  handleAnswerUrlWebhook,
  handleCallEventsWebhook,
  getLeadCallHistoryController,
  getCallLogs,
  getCallLogById,
} from "../controllers/dialerController.js";

const router = Router();

// 1. Secure route for logged-in users to start WebRTC calling session
router.get(
  "/token",
  authenticate,
  authorize(PERMISSIONS.CALL_INITIATE),
  // trackActivity("CALL_LOG", "TOKEN_GENERATED", (req) => {
  //   const user = (req as any).user;
  //   return `Generated Stringee WebRTC access token for ${user?.name || user?.email || "User"}`;
  // }),
  getStringeeTokenController,
);

// 2. Fetch call logs (Read-only routes)
router.get(
  "/lead/:leadId",
  authenticate,
  authorize(PERMISSIONS.CALL_LOG_VIEW),
  getLeadCallHistoryController,
);

router.get(
  "/logs",
  authenticate,
  authorize(PERMISSIONS.CALL_LOG_VIEW),
  getCallLogs,
);

router.get(
  "/logs/:id",
  authenticate,
  authorize(PERMISSIONS.CALL_LOG_VIEW),
  getCallLogById,
);

// 3. Webhook routes (Stringee Server Handlers)
router
  .route("/answer-url")
  .get(
    trackActivity(
      "CALL_LOG",
      "ANSWER_URL_REQUESTED",
      (req) =>
        `Stringee Answer-URL webhook triggered from: ${req.query.from || req.body.from || "Unknown"}`,
    ),
    handleAnswerUrlWebhook,
  )
  .post(
    trackActivity(
      "CALL_LOG",
      "ANSWER_URL_REQUESTED",
      (req) =>
        `Stringee Answer-URL webhook triggered from: ${req.body.from || req.query.from || "Unknown"}`,
    ),
    handleAnswerUrlWebhook,
  );

router.post(
  "/events",
  trackActivity(
    "CALL_LOG",
    "EVENT_RECEIVED",
    (req) =>
      `Call event '${req.body?.call_status || req.body?.event}' logged for call ID: ${req.body?.call_id}`,
  ),
  handleCallEventsWebhook,
);

export default router;
