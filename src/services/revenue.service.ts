// src/services/revenue.service.ts
import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { Revenue, REVENUE_STATUS } from "../models/Revenue.js";
import { User } from "../models/User.js";
import { EmployeeProfile } from "../models/EmployeeProfile.js";
import { ROLES } from "../constants/roles.js";
import type { AuthenticatedUser } from "../types/auth.js";
import { AppError } from "../utils/AppError.js";
import { Lead } from "../models/Lead.js";

// Validation Schemas
export const createRevenueSchema = z.object({
  employeeId: z.string().optional(),
  branchId: z.string().optional(),
  leadId: z.string().optional(),
  date: z.string().datetime({ offset: true }).optional(),
  amount: z.number().positive(),
  source: z.string().min(1).max(100),
  clientName: z.string().min(1).max(150),
  clientContact: z.string().max(50).optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateRevenueStatusSchema = z.object({
  status: z.enum([REVENUE_STATUS.VERIFIED, REVENUE_STATUS.REJECTED]),
  notes: z.string().max(1000).optional(),
});

export const revenueQuerySchema = z.object({
  targetUserId: z.string().optional(),
  employeeId: z.string().optional(),
  branchId: z.string().optional(),
  leadId: z.string().optional(),
  status: z
    .enum([
      REVENUE_STATUS.PENDING,
      REVENUE_STATUS.VERIFIED,
      REVENUE_STATUS.REJECTED,
    ])
    .optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
  viewMode: z
    .enum(["INDIVIDUAL", "TEAM", "BRANCH", "LEAD"])
    .default("INDIVIDUAL"),
});

// Helper: Resolve Employee User ID (Supports User ID or EmployeeProfile lookup)
const resolveUserId = async (id: string): Promise<Types.ObjectId> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid user ID format", 400, "INVALID_ID");
  }

  // 1. Check if ID directly matches a User
  const directUser = await User.findById(id).select("_id").lean();
  if (directUser) return directUser._id as Types.ObjectId;

  // 2. Check if ID matches an EmployeeProfile
  const profile = await EmployeeProfile.findOne({
    $or: [{ _id: new Types.ObjectId(id) }, { user: new Types.ObjectId(id) }],
  })
    .select("user")
    .lean();

  if (profile) return profile.user;

  throw new AppError("Target employee not found", 404, "EMPLOYEE_NOT_FOUND");
};

// 1. Create Revenue Entry
export const createRevenueEntry = async (
  requestor: AuthenticatedUser,
  rawData: unknown,
) => {
  const result = createRevenueSchema.safeParse(rawData);
  if (!result.success) {
    const errs = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new AppError(`Invalid revenue data: ${errs}`, 400, "INVALID_INPUT");
  }

  const {
    employeeId,
    branchId,
    leadId,
    date,
    amount,
    source,
    clientName,
    clientContact,
    reference,
    notes,
  } = result.data;

  const rawTargetId = employeeId || requestor.id;
  const targetUserId = await resolveUserId(rawTargetId);

  // Authorization check for target employee
  if (requestor.role === ROLES.EMPLOYEE && targetUserId.toString() !== requestor.id) {
    throw new AppError(
      "Employees can only log revenue for themselves",
      403,
      "ACCESS_DENIED",
    );
  }

  // Lead Ownership Check with Optional Chaining Fix
  if (leadId) {
    if (!Types.ObjectId.isValid(leadId)) {
      throw new AppError("Invalid lead ID format", 400, "INVALID_LEAD_ID");
    }

    const lead = await Lead.findById(leadId).lean();
    if (!lead || lead.isDeleted) {
      throw new AppError("Associated lead not found", 404, "LEAD_NOT_FOUND");
    }

    if (
      requestor.role === ROLES.EMPLOYEE &&
      (!lead.assignedTo || lead.assignedTo.toString() !== requestor.id)
    ) {
      throw new AppError(
        "You can only log revenue for leads assigned to you",
        403,
        "LEAD_ACCESS_DENIED",
      );
    }
  }

  const employeeUser = await User.findById(targetUserId).lean();
  if (!employeeUser || !employeeUser.isActive) {
    throw new AppError(
      "Target employee not found or inactive",
      404,
      "EMPLOYEE_NOT_FOUND",
    );
  }

  const assignedBranch = branchId || employeeUser.branches[0]?.toString();
  if (!assignedBranch) {
    throw new AppError(
      "Branch assignment missing for revenue entry",
      400,
      "MISSING_BRANCH",
    );
  }

  const newRevenue = await Revenue.create({
    employee: employeeUser._id,
    branch: new Types.ObjectId(assignedBranch),
    lead: leadId ? new Types.ObjectId(leadId) : undefined,
    date: date ? new Date(date) : new Date(),
    amount,
    source,
    clientName,
    clientContact,
    reference,
    notes,
    createdBy: new Types.ObjectId(requestor.id),
  });

  return newRevenue;
};

// 2. Fetch & Aggregate Revenue Reports
export const getRevenueReport = async (
  requestor: AuthenticatedUser,
  rawQueryParams: unknown,
) => {
  const result = revenueQuerySchema.safeParse(rawQueryParams);
  if (!result.success) {
    const errs = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new AppError(`Invalid parameters: ${errs}`, 400, "INVALID_QUERY");
  }

  const {
    targetUserId,
    employeeId,
    branchId,
    leadId,
    status,
    startDate,
    endDate,
    viewMode,
  } = result.data;

  // Lead-based Query Shortcut
  if (leadId || viewMode === "LEAD") {
    if (!leadId || !Types.ObjectId.isValid(leadId)) {
      throw new AppError(
        "Valid leadId is required for LEAD view",
        400,
        "INVALID_LEAD_ID",
      );
    }
    const leadRevenues = await Revenue.find({
      lead: new Types.ObjectId(leadId),
    })
      .populate("employee", "name email")
      .populate("branch", "name code")
      .populate("verifiedBy", "name")
      .sort({ date: -1 })
      .lean();

    const totalAmount = leadRevenues.reduce(
      (acc, curr) => acc + curr.amount,
      0,
    );
    return {
      scope: { viewMode: "LEAD", leadId },
      summary: { totalAmount, count: leadRevenues.length },
      records: leadRevenues,
    };
  }

  let targetUserIds: Types.ObjectId[] = [];
  let scopeInfo: Record<string, unknown> = { viewMode };

  if (viewMode === "INDIVIDUAL") {
    const rawId = targetUserId || employeeId || requestor.id;
    const resolvedId = await resolveUserId(rawId);

    if (
      requestor.role === ROLES.EMPLOYEE &&
      resolvedId.toString() !== requestor.id
    ) {
      throw new AppError(
        "Access denied to individual metrics",
        403,
        "ACCESS_DENIED",
      );
    }

    if (requestor.role === ROLES.MANAGER) {
      if (resolvedId.toString() !== requestor.id) {
        const isSubordinate = await EmployeeProfile.exists({
          user: resolvedId,
          reportingManager: new Types.ObjectId(requestor.id),
        });
        if (!isSubordinate) {
          throw new AppError(
            "Managers can only view revenue of their team members",
            403,
            "ACCESS_DENIED",
          );
        }
      }
    }

    targetUserIds = [resolvedId];
    scopeInfo.targetUserId = resolvedId;
  } else if (viewMode === "TEAM") {
    if (requestor.role === ROLES.EMPLOYEE) {
      throw new AppError(
        "Employees cannot view team revenue",
        403,
        "ACCESS_DENIED",
      );
    }
    const rawManagerId = targetUserId || employeeId || requestor.id;
    const managerId = await resolveUserId(rawManagerId);

    const teamProfiles = await EmployeeProfile.find({
      reportingManager: managerId,
    })
      .select("user")
      .lean();

    targetUserIds = teamProfiles.map((p) => p.user);
    targetUserIds.push(managerId);
    scopeInfo.teamSize = targetUserIds.length;
  } else if (viewMode === "BRANCH") {
    if (
      requestor.role === ROLES.EMPLOYEE ||
      requestor.role === ROLES.MANAGER
    ) {
      throw new AppError(
        "Only Admins and Head can access full branch revenue",
        403,
        "ACCESS_DENIED",
      );
    }

    const selectedBranch = branchId || requestor.branches[0]?.toString();

    if (!selectedBranch || !Types.ObjectId.isValid(selectedBranch)) {
      throw new AppError(
        "Valid Branch ID is required for branch view",
        400,
        "INVALID_BRANCH_ID",
      );
    }

    if (
      requestor.role === ROLES.ADMIN &&
      !requestor.branches.includes(selectedBranch)
    ) {
      throw new AppError(
        "Access denied to unassigned branch",
        403,
        "ACCESS_DENIED",
      );
    }

    const branchUsers = await User.find({
      branches: new Types.ObjectId(selectedBranch),
      isActive: true,
    })
      .select("_id")
      .lean();
    targetUserIds = branchUsers.map((u) => u._id as Types.ObjectId);
    scopeInfo.branchId = selectedBranch;
  }

  // Construct Match Query
  const matchQuery: Record<string, unknown> = {
    employee: { $in: targetUserIds },
  };

  if (status) matchQuery.status = status;
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate)
      (matchQuery.date as Record<string, Date>).$gte = new Date(startDate);
    if (endDate)
      (matchQuery.date as Record<string, Date>).$lte = new Date(endDate);
  }

  // Perform Aggregation
  const summaryPipeline = await Revenue.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$status",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const records = await Revenue.find(matchQuery)
    .populate("employee", "name email")
    .populate("branch", "name code")
    .populate("lead", "title status")
    .sort({ date: -1 })
    .lean();

  return {
    scope: scopeInfo,
    period: {
      startDate: startDate || "ALL_TIME",
      endDate: endDate || "ALL_TIME",
    },
    summary: summaryPipeline,
    records,
  };
};

// 3. Verify / Reject Revenue Entry (Admin & Head Only)
export const updateRevenueStatus = async (
  requestor: AuthenticatedUser,
  revenueId: string,
  rawData: unknown,
) => {
  if (requestor.role !== ROLES.ADMIN && requestor.role !== ROLES.HEAD && requestor.role !== ROLES.MANAGER) {
    throw new AppError(
      "Only Admins and Head can verify or reject revenue",
      403,
      "ACCESS_DENIED",
    );
  }

  const result = updateRevenueStatusSchema.safeParse(rawData);
  if (!result.success) {
    throw new AppError("Invalid status or payload", 400, "INVALID_INPUT");
  }

  const revenue = await Revenue.findById(revenueId);
  if (!revenue) {
    throw new AppError("Revenue record not found", 404, "NOT_FOUND");
  }

  if (
    requestor.role === ROLES.ADMIN &&
    !requestor.branches.includes(revenue.branch.toString())
  ) {
    throw new AppError(
      "Cannot manage revenue outside assigned branches",
      403,
      "ACCESS_DENIED",
    );
  }

  revenue.status = result.data.status;
  revenue.verifiedBy = new Types.ObjectId(requestor.id);
  revenue.verifiedAt = new Date();
  if (result.data.notes) revenue.notes = result.data.notes;

  await revenue.save();
  return revenue;
};