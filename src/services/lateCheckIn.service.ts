import mongoose from "mongoose";
import {
  LateCheckInRequest,
  LATE_CHECKIN_STATUS,
} from "../models/LateCheckInRequest.js";
import { User } from "../models/User.js";
import { ROLES } from "../constants/roles.js";
import { AppError } from "../utils/AppError.js";
import {
  isAfterWorkingHours,
  getUtcNormalizedDate,
} from "../utils/workingHours.js";
import type { AuthenticatedUser } from "../types/auth.js";

export const submitLateCheckInReason = async (
  userId: string,
  reason: string,
) => {
  const user = await User.findById(userId)
    .select("branches role isActive")
    .lean();
  if (!user || !user.isActive) {
    throw new AppError("Active account required", 403, "INACTIVE_USER");
  }

  const primaryBranch = user.branches?.[0];
  if (!primaryBranch) {
    throw new AppError("No branch assigned to user", 400, "NO_BRANCH");
  }

  const isAfter = await isAfterWorkingHours(primaryBranch.toString());
  if (!isAfter) {
    throw new AppError(
      "Regular check-in allowed; you are within working hours",
      400,
      "REGULAR_HOURS",
    );
  }

  const today = getUtcNormalizedDate();

  const existingRequest = await LateCheckInRequest.findOne({
    employee: userId,
    requestDate: today,
  });

  if (existingRequest) {
    if (existingRequest.status === LATE_CHECKIN_STATUS.PENDING) {
      throw new AppError(
        "A late check-in request is already pending approval",
        400,
        "REQUEST_PENDING",
      );
    }
    if (existingRequest.status === LATE_CHECKIN_STATUS.APPROVED) {
      throw new AppError(
        "Late check-in already approved for today",
        400,
        "ALREADY_APPROVED",
      );
    }
  }

  return LateCheckInRequest.create({
    employee: userId,
    branch: primaryBranch,
    requestDate: today,
    reason,
    status: LATE_CHECKIN_STATUS.PENDING,
  });
};

export const reviewLateCheckIn = async (
  reviewer: AuthenticatedUser,
  requestId: string,
  status:
    | typeof LATE_CHECKIN_STATUS.APPROVED
    | typeof LATE_CHECKIN_STATUS.REJECTED,
  remarks?: string,
) => {
  if (
    ![ROLES.HEAD, ROLES.ADMIN, ROLES.MANAGER].includes(reviewer.role as any)
  ) {
    throw new AppError("Access denied", 403, "ACCESS_DENIED");
  }

  const request = await LateCheckInRequest.findById(requestId);
  if (!request) {
    throw new AppError("Late check-in request not found", 404, "NOT_FOUND");
  }

  // Branch access check for Manager/Admin
  if (reviewer.role !== ROLES.HEAD) {
    const reviewerBranchIds = (reviewer.branches || []).map((b) =>
      b.toString(),
    );
    if (!reviewerBranchIds.includes(request.branch.toString())) {
      throw new AppError(
        "Unauthorized for this branch",
        403,
        "BRANCH_ACCESS_DENIED",
      );
    }
  }

  request.status = status;
  request.reviewedBy = new mongoose.Types.ObjectId(reviewer.id);
  request.reviewedAt = new Date();
  if (remarks) request.reviewRemarks = remarks;

  await request.save();
  return request;
};

export const checkAccessPermission = async (
  userId: string,
  userRole: string,
  branchId?: string,
) => {
  // Head/Admin/Manager can bypass late checks
  if (userRole !== ROLES.EMPLOYEE) {
    return { allowed: true };
  }

  if (!branchId) return { allowed: true };

  const isAfter = await isAfterWorkingHours(branchId);
  if (!isAfter) {
    return { allowed: true }; // Normal working hours
  }

  const today = getUtcNormalizedDate();
  const request = await LateCheckInRequest.findOne({
    employee: userId,
    requestDate: today,
  });

  if (!request) {
    return {
      allowed: false,
      reasonRequired: true,
      message: "Working hours ended. Please submit a reason to log in.",
    };
  }

  if (request.status === LATE_CHECKIN_STATUS.PENDING) {
    return {
      allowed: false,
      reasonRequired: false,
      message: "Late check-in request is pending Head/Manager approval.",
    };
  }

  if (request.status === LATE_CHECKIN_STATUS.REJECTED) {
    return {
      allowed: false,
      reasonRequired: false,
      message: "Late check-in request was rejected.",
    };
  }

  return { allowed: true }; // Approved
};

