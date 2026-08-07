import { Types } from "mongoose";
import bcrypt from "bcryptjs";

import { ROLES, type Role } from "../constants/roles.js";
import { Branch } from "../models/Branch.js";
import { User, type IUser } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { ROLE_HIERARCHY, canManageRole } from "../permissions/roleHierarchy.js";
import type { UpdateUserInput, UserListQuery } from "../types/user.js";


interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  branches?: string[];
}

export const canCreateRole = (creatorRole: Role, targetRole: Role): boolean => {
  const allowedRoles = ROLE_HIERARCHY[creatorRole] ?? [];

  return allowedRoles.includes(targetRole);
};

export const createUser = async (
  data: CreateUserInput,
  creatorId: string,
  creatorRole: Role,
) => {
  const { name, email, password, role, branches = [] } = data;

  if (!name?.trim()) {
    throw new AppError("Name is required", 400, "NAME_REQUIRED");
  }

  if (!email?.trim()) {
    throw new AppError("Email is required", 400, "EMAIL_REQUIRED");
  }

  if (!password) {
    throw new AppError("Password is required", 400, "PASSWORD_REQUIRED");
  }

  if (!Object.values(ROLES).includes(role as any)) {
    throw new AppError("Invalid role", 400, "INVALID_ROLE");
  }

  if (!canCreateRole(creatorRole, role)) {
    throw new AppError(
      `You cannot create a user with role ${role}`,
      403,
      "ROLE_CREATION_FORBIDDEN",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw new AppError(
      "A user with this email already exists",
      409,
      "USER_EMAIL_EXISTS",
    );
  }

  const validBranchIds: Types.ObjectId[] = [];

  for (const branchId of branches) {
    if (!Types.ObjectId.isValid(branchId)) {
      throw new AppError(
        `Invalid branch ID: ${branchId}`,
        400,
        "INVALID_BRANCH_ID",
      );
    }

    const branch = await Branch.findOne({
      _id: branchId,
      isActive: true,
    });

    if (!branch) {
      throw new AppError(
        `Branch not found or inactive: ${branchId}`,
        404,
        "BRANCH_NOT_FOUND",
      );
    }

    validBranchIds.push(new Types.ObjectId(branchId));
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword, // 👈 Pass hashedPassword here!
    role,
    branches: validBranchIds,
    createdBy: new Types.ObjectId(creatorId),
    isActive: true,
  });

  return user;
};

export const updateUserBranches = async (
  userId: string,
  branchIds: string[],
  actorId: string,
  actorRole: Role,
) => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new AppError(
      "Invalid user ID",
      400,
      "INVALID_USER_ID",
    );
  }

  const targetUser =
    await User.findById(userId);

  if (!targetUser) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND",
    );
  }

  if (
    targetUser.role === ROLES.HEAD
  ) {
    throw new AppError(
      "Head user branch access cannot be modified",
      403,
      "HEAD_BRANCH_UPDATE_FORBIDDEN",
    );
  }

  if (
    !canManageRole(
      actorRole,
      targetUser.role,
    )
  ) {
    throw new AppError(
      "You do not have permission to manage this user",
      403,
      "USER_MANAGEMENT_FORBIDDEN",
    );
  }

  const validBranchIds: Types.ObjectId[] = [];

  for (const branchId of branchIds) {
    if (!Types.ObjectId.isValid(branchId)) {
      throw new AppError(
        `Invalid branch ID: ${branchId}`,
        400,
        "INVALID_BRANCH_ID",
      );
    }

    const branch =
      await Branch.findOne({
        _id: branchId,
        isActive: true,
      });

    if (!branch) {
      throw new AppError(
        `Branch not found or inactive: ${branchId}`,
        404,
        "BRANCH_NOT_FOUND",
      );
    }

    validBranchIds.push(
      new Types.ObjectId(branchId),
    );
  }

  if (actorRole !== ROLES.HEAD) {
    const actor =
      await User.findById(actorId).select(
        "branches role",
      );

    if (!actor) {
      throw new AppError(
        "Actor not found",
        404,
        "ACTOR_NOT_FOUND",
      );
    }

    const actorBranchIds =
      actor.branches.map((id) =>
        id.toString(),
      );

    const hasUnauthorizedBranch =
      validBranchIds.some(
        (branchId) =>
          !actorBranchIds.includes(
            branchId.toString(),
          ),
      );

    if (hasUnauthorizedBranch) {
      throw new AppError(
        "You cannot assign a branch you do not have access to",
        403,
        "BRANCH_ASSIGNMENT_FORBIDDEN",
      );
    }
  }

  targetUser.branches =
    validBranchIds;

  await targetUser.save();

  return targetUser;
};

export const getUsers = async (
  query: UserListQuery,
  actorId: string,
  actorRole: Role
) => {
  // 1. Pagination Boundaries
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  // 2. Safely infer filter type directly from User model to prevent Mongoose version issues
  const filter: Record<string, any> = {};

  // 3. Role Filter
  if (query.role) {
    filter.role = query.role;
  }

  // 4. Status Filter
  if (query.isActive !== undefined) {
    // Convert string query params ('true'/'false') to boolean if passed from req.query
    filter.isActive =
      typeof query.isActive === "string"
        ? query.isActive === "true"
        : Boolean(query.isActive);
  }

  // 5. Case-insensitive Search Filter
  if (query.search?.trim()) {
    const search = query.search.trim();

    filter.$or = [
      {
        name: {
          $regex: search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  // 6. Branch Security Scope Enforcement
  if (actorRole !== ROLES.HEAD) {
    const actor = await User.findById(actorId).select("branches role");

    if (!actor) {
      throw new AppError("Actor not found", 404, "ACTOR_NOT_FOUND");
    }

    if (!actor.branches || actor.branches.length === 0) {
      return {
        users: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const accessibleBranches = actor.branches;

    if (query.branchId) {
      if (!Types.ObjectId.isValid(query.branchId)) {
        throw new AppError("Invalid branch ID", 400, "INVALID_BRANCH_ID");
      }

      const hasAccess = accessibleBranches.some(
        (branchId) => branchId.toString() === query.branchId
      );

      if (!hasAccess) {
        throw new AppError(
          "You do not have access to this branch",
          403,
          "BRANCH_ACCESS_FORBIDDEN"
        );
      }

      filter.branches = new Types.ObjectId(query.branchId);
    } else {
      filter.branches = {
        $in: accessibleBranches,
      };
    }
  } else if (query.branchId) {
    // HEAD role requesting specific branch
    if (!Types.ObjectId.isValid(query.branchId)) {
      throw new AppError("Invalid branch ID", 400, "INVALID_BRANCH_ID");
    }

    filter.branches = new Types.ObjectId(query.branchId);
  }

  // 7. Concurrent Execution of Query and Document Count
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("_id name email role branches isActive createdAt updatedAt")
      .populate("branches", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    User.countDocuments(filter),
  ]);

  // 8. Return Safe Fields with Pagination Metadata
  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const updateUser = async (
  userId: string,
  data: UpdateUserInput,
  actorId: string,
  actorRole: Role,
) => {
  if (!Types.ObjectId.isValid(userId)) {
  throw new AppError(
    "Invalid user ID",
    400,
    "INVALID_USER_ID",
  );
}

const targetUser =
  await User.findById(userId);

if (!targetUser) {
  throw new AppError(
    "User not found",
    404,
    "USER_NOT_FOUND",
  );
}

if (userId === actorId) {
  throw new AppError(
    "You cannot update your own account through this endpoint",
    403,
    "SELF_UPDATE_FORBIDDEN",
  );
}

if (targetUser.role === ROLES.HEAD) {
  throw new AppError(
    "Head user cannot be modified through this endpoint",
    403,
    "HEAD_UPDATE_FORBIDDEN",
  );
}

if (
  !canManageRole(
    actorRole,
    targetUser.role,
  )
) {
  throw new AppError(
    "You do not have permission to manage this user",
    403,
    "USER_MANAGEMENT_FORBIDDEN",
  );
}

if (data.role) {
  if (
    data.role === ROLES.HEAD
  ) {
    throw new AppError(
      "Head role cannot be assigned through this endpoint",
      403,
      "HEAD_ROLE_ASSIGNMENT_FORBIDDEN",
    );
  }

  if (
    !canManageRole(
      actorRole,
      data.role,
    )
  ) {
    throw new AppError(
      "You cannot assign this role",
      403,
      "ROLE_ASSIGNMENT_FORBIDDEN",
    );
  }
}

if (data.email) {
  const normalizedEmail =
    data.email.trim().toLowerCase();

  const existingUser =
    await User.findOne({
      email: normalizedEmail,
      _id: {
        $ne: targetUser._id,
      },
    });

  if (existingUser) {
    throw new AppError(
      "A user with this email already exists",
      409,
      "EMAIL_ALREADY_EXISTS",
    );
  }

  targetUser.email =
    normalizedEmail;
}

if (data.name !== undefined) {
  targetUser.name =
    data.name.trim();
}

if (data.role !== undefined) {
  targetUser.role = data.role;
}

await targetUser.save();

return {
  id: targetUser._id,
  name: targetUser.name,
  email: targetUser.email,
  role: targetUser.role,
  branches: targetUser.branches,
  isActive: targetUser.isActive,
};

}

export const updateUserStatus = async (
  userId: string,
  isActive: boolean,
  actorId: string,
  actorRole: Role,
) => {
  if (!Types.ObjectId.isValid(userId)) {
  throw new AppError(
    "Invalid user ID",
    400,
    "INVALID_USER_ID",
  );
}

const targetUser =
  await User.findById(userId);

if (!targetUser) {
  throw new AppError(
    "User not found",
    404,
    "USER_NOT_FOUND",
  );
}

if (userId === actorId) {
  throw new AppError(
    "You cannot change your own account status",
    403,
    "SELF_STATUS_UPDATE_FORBIDDEN",
  );
}

if (targetUser.role === ROLES.HEAD) {
  throw new AppError(
    "Head user status cannot be modified",
    403,
    "HEAD_STATUS_UPDATE_FORBIDDEN",
  );
}

if (
  !canManageRole(
    actorRole,
    targetUser.role,
  )
) {
  throw new AppError(
    "You do not have permission to manage this user",
    403,
    "USER_MANAGEMENT_FORBIDDEN",
  );
}

if (targetUser.isActive === isActive) {
  return targetUser;
}

targetUser.isActive = isActive;

await targetUser.save();

return targetUser;


}