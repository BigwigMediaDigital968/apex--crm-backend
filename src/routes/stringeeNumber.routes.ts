import { Router } from "express";
import {
  createNumber,
  getNumbers,
  assignNumber,
  updateNumber,
} from "../controllers/stringeeNumber.controller.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";

const router = Router();

router.use(authenticate);

router.post(
  "/add",
  authorize(PERMISSIONS.STRINGEE_NUMBER_CREATE),
  createNumber,
);

router.put(
  "/:numberId",
  authorize(PERMISSIONS.STRINGEE_NUMBER_UPDATE),
  updateNumber
);

router.get("/list", authorize(PERMISSIONS.STRINGEE_NUMBER_VIEW), getNumbers);

router.patch(
  "/:numberId/assign",
  authorize(PERMISSIONS.STRINGEE_NUMBER_ASSIGN),
  assignNumber,
);

export default router;
