import { Types } from "mongoose";

import {
  type EmploymentStatus,
  type EmploymentType,
  type Gender,
} from "../constants/employee.js";

import {
  EmployeeProfile,
  type IEmployeeDocument,
} from "../models/EmployeeProfile.js";

import { User } from "../models/User.js";

import { Branch } from "../models/Branch.js";

import { ROLES, type Role } from "../constants/roles.js";

import { AppError } from "../utils/AppError.js";

interface CreateEmployeeInput {
  userId: string;
  employeeCode: string;
  branchId: string;
  reportingManager?: string;
  designation?: string;
  department?: string;
  employmentType: EmploymentType; // Fixed: string -> EmploymentType
  employmentStatus?: EmploymentStatus; // Fixed: string | undefined -> EmploymentStatus | undefined
  joiningDate: Date;
  probationEndDate?: Date;
  dateOfBirth?: Date;
  gender?: Gender; // Fixed: string | undefined -> Gender | undefined
  personalPhone?: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  documents?: IEmployeeDocument[]; // Fixed: unknown[] -> IEmployeeDocument[]
  salary: Record<string, number>;
  bankDetails?: Record<string, string>;
  notes?: string;
}

interface AccessContext {
  userId: string;
  role: Role;
  branches: string[];
}

const assertBranchAccess = (branchId: string, context: AccessContext) => {
  if (context.role === ROLES.HEAD) {
    return;
  }

  if (!context.branches.includes(branchId)) {
    throw new AppError(
      "You do not have access to this branch",
      403,
      "BRANCH_ACCESS_DENIED",
    );
  }
};

export const createEmployeeProfile = async (
  data: CreateEmployeeInput,
  context: AccessContext,
) => {
  assertBranchAccess(data.branchId, context);

  const user = await User.findById(data.userId);

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  if (!user.isActive) {
    throw new AppError(
      "Cannot create employee profile for inactive user",
      400,
      "USER_INACTIVE",
    );
  }

  const branch = await Branch.findById(data.branchId);

  if (!branch || !branch.isActive) {
    throw new AppError("Branch not found or inactive", 404, "BRANCH_NOT_FOUND");
  }

  const existingProfile = await EmployeeProfile.findOne({
    user: data.userId,
  });

  if (existingProfile) {
    throw new AppError(
      "Employee profile already exists",
      409,
      "EMPLOYEE_PROFILE_EXISTS",
    );
  }

  const existingCode = await EmployeeProfile.findOne({
    employeeCode: data.employeeCode.toUpperCase(),
  });

  if (existingCode) {
    throw new AppError(
      "Employee code already exists",
      409,
      "EMPLOYEE_CODE_EXISTS",
    );
  }

  if (data.reportingManager) {
    const manager = await User.findById(data.reportingManager);

    if (!manager) {
      throw new AppError(
        "Reporting manager not found",
        404,
        "MANAGER_NOT_FOUND",
      );
    }

    if (manager.role !== ROLES.MANAGER) {
      throw new AppError(
        "Reporting manager must have manager role",
        400,
        "INVALID_REPORTING_MANAGER",
      );
    }

    const managerHasBranch = manager.branches.some(
      (id) => id.toString() === data.branchId,
    );

    if (!managerHasBranch) {
      throw new AppError(
        "Reporting manager does not belong to this branch",
        400,
        "MANAGER_BRANCH_MISMATCH",
      );
    }
  }

  const employee = await EmployeeProfile.create({
    user: new Types.ObjectId(data.userId),

    employeeCode: data.employeeCode.toUpperCase(),

    branch: new Types.ObjectId(data.branchId),

    reportingManager: data.reportingManager
      ? new Types.ObjectId(data.reportingManager)
      : undefined,

    designation: data.designation,

    department: data.department,

    employmentType: data.employmentType,

    employmentStatus: data.employmentStatus ?? "active",

    joiningDate: data.joiningDate,

    probationEndDate: data.probationEndDate,

    dateOfBirth: data.dateOfBirth,

    gender: data.gender,

    personalPhone: data.personalPhone,

    alternatePhone: data.alternatePhone,

    address: data.address,

    city: data.city,

    state: data.state,

    country: data.country ?? "India",

    postalCode: data.postalCode,

    emergencyContactName: data.emergencyContactName,

    emergencyContactPhone: data.emergencyContactPhone,

    emergencyContactRelation: data.emergencyContactRelation,

    documents: data.documents ?? [],

    salary: data.salary,

    bankDetails: data.bankDetails,

    notes: data.notes,

    createdBy: new Types.ObjectId(context.userId),
  });

  return employee;
};

export const getEmployeeProfileById = async (
  employeeId: string,
  context: AccessContext,
) => {
  const employee = await EmployeeProfile.findById(employeeId)
    .populate("user", "name email role isActive")
    .populate("branch", "name code city state")
    .populate("reportingManager", "name email role")
    .lean();

  if (!employee) {
    throw new AppError("Employee profile not found", 404, "EMPLOYEE_NOT_FOUND");
  }

  const branchId = employee.branch._id.toString();

  if (context.role !== ROLES.HEAD && !context.branches.includes(branchId)) {
    throw new AppError(
      "You do not have access to this employee",
      403,
      "EMPLOYEE_ACCESS_DENIED",
    );
  }

  if (
    context.role === ROLES.EMPLOYEE &&
    employee.user._id.toString() !== context.userId
  ) {
    throw new AppError(
      "You can only access your own employee profile",
      403,
      "EMPLOYEE_ACCESS_DENIED",
    );
  }

  return employee;
};

export const listEmployees = async (
  context: AccessContext,
  options: {
    page: number;
    limit: number;
    branchId?: string;
    status?: string;
    search?: string;
  },
) => {
  const filter: Record<string, unknown> = {};

  if (context.role !== ROLES.HEAD) {
    filter.branch = {
      $in: context.branches.map((id) => new Types.ObjectId(id)),
    };
  }

  if (options.branchId && context.role === ROLES.HEAD) {
    filter.branch = new Types.ObjectId(options.branchId);
  }

  if (options.status) {
    filter.employmentStatus = options.status;
  }

  if (options.search) {
    filter.$or = [
      {
        employeeCode: {
          $regex: options.search,
          $options: "i",
        },
      },
      {
        designation: {
          $regex: options.search,
          $options: "i",
        },
      },
      {
        department: {
          $regex: options.search,
          $options: "i",
        },
      },
    ];
  }

  if (context.role === ROLES.EMPLOYEE) {
    filter.user = new Types.ObjectId(context.userId);
  }

  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    EmployeeProfile.find(filter)
      .populate("user", "name email role isActive")
      .populate("branch", "name code city")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(options.limit)
      .lean(),

    EmployeeProfile.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.ceil(total / options.limit),
    },
  };
};
