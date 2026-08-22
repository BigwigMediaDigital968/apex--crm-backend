import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { uploadMedia } from "../config/cloudinary.js";
import {
  launchContestHandler,
  getMyBranchContestsHandler,
  updateContestHandler,
  toggleContestStatusHandler,
  getAllContestsHandler
} from "../controllers/contest.controller.js";

const router = Router();

router.use(authenticate);

// Head launches contest with optional PDF/Image/Video file
router.post("/", uploadMedia.single("media"), launchContestHandler);

router.get("/all", getAllContestsHandler);

// Employees/Branch Users fetch active contests for their assigned branch
router.get("/my-branch", getMyBranchContestsHandler);

// Update Contest Details or Media File (Head Only)
router.patch("/:id", uploadMedia.single("media"), updateContestHandler);

// Toggle Active / Inactive Status (Head Only)
router.patch("/:id/status", toggleContestStatusHandler);

export default router;
