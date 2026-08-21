// src/routes/dialer.routes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  getStringeeTokenController,
  handleAnswerUrlWebhook,
  handleCallEventsWebhook,
  getLeadCallHistoryController,
} from "../controllers/dialerController.js";

const router = Router();

// Secure route for logged-in users to start WebRTC calling session
router.get(
  "/token",
  authenticate,
  authorize(PERMISSIONS.CALL_INITIATE),
  getStringeeTokenController
);

// Secure route to fetch call logs for a lead
router.get(
  "/lead/:leadId",
  authenticate,
  authorize(PERMISSIONS.CALL_LOG_VIEW),
  getLeadCallHistoryController
);

// Webhook routes (Public endpoints hit directly by Stringee servers)
router.post("/answer-url", handleAnswerUrlWebhook);
router.post("/events", handleCallEventsWebhook);

export default router;