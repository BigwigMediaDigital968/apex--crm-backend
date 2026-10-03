import { Types, type ClientSession } from "mongoose";

import { ROLES, type Role } from "../constants/roles.js";
import { EmployeeProfile } from "../models/EmployeeProfile.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";

/**
 * Branch invariant
 * ----------------
 * `User.branches` is the source of truth for which branch(es) a person
 * belongs to. `EmployeeProfile.branch` is a denormalised copy used by HR
 * views and branch-scoped employee lookups (e.g. lead assignment), so it must
 * always be one of the user's branches:
 *   - employee / manager (single-branch roles): profile.branch === user.branches[0]
 *   - admin: profile.branch ∈ user.branches
 *   - head: unrestricted (global access, usually no branches assigned)
 *
 * Branch moves go through `updateUserBranches`; profile writes derive or
 * validate their branch here. A profile's `reportingManager` must also share
 * the profile's branch, so it is cleared when a move breaks that.
 */

export const SINGLE_BRANCH_ROLES: readonly Role[] = [
  ROLES.EMPLOYEE,
  ROLES.MANAGER,
];

export const isSingleBranchRole = (role: Role) =>
  SINGLE_BRANCH_ROLES.includes(role);

interface BranchOwner {
  _id: Types.ObjectId;
  role: Role;
  branches: Types.ObjectId[];
}

/**
 * Resolves the branch a profile write must store for `user`.
 *
 * For single-branch roles the branch is derived from the user and any
 * requested value is ignored — clients may still send a stale branch (the
 * profile form's branch field is read-only), and moving such a user is done
 * via `updateUserBranches`. For admins the requested branch must be one of
 * the user's branches.
 */
export const resolveProfileBranch = (
  user: BranchOwner,
  requested?: string,
  current?: string,
): string => {
  const userBranchIds = user.branches.map((id) => id.toString());

  if (user.role === ROLES.HEAD) {
    const branchId = requested ?? current;
    if (!branchId) {
      throw new AppError("Branch is required", 400, "BRANCH_REQUIRED");
    }
    return branchId;
  }

  const [firstBranchId] = userBranchIds;

  if (!firstBranchId) {
    throw new AppError(
      "This user has no branch assigned. Assign a branch to the user first.",
      400,
      "USER_BRANCH_MISSING",
    );
  }

  if (isSingleBranchRole(user.role)) {
    return firstBranchId;
  }

  if (requested) {
    if (!userBranchIds.includes(requested)) {
      throw new AppError(
        "Profile branch must be one of the user's assigned branches",
        400,
        "BRANCH_NOT_ASSIGNED_TO_USER",
      );
    }
    return requested;
  }

  return current && userBranchIds.includes(current) ? current : firstBranchId;
};

/** True when `managerId` is assigned to `branchId`. */
export const managerBelongsToBranch = async (
  managerId: Types.ObjectId,
  branchId: string,
  session?: ClientSession,
) =>
  Boolean(
    await User.exists({
      _id: managerId,
      branches: new Types.ObjectId(branchId),
    }).session(session ?? null),
  );

/**
 * Brings the HR side in line after `user`'s branches (or role) changed:
 *  1. moves the user's own profile into one of their branches, clearing its
 *     reporting manager if that manager is not in the new branch;
 *  2. detaches profiles that report to `user` but sit outside the user's
 *     branches (a manager moved away from their old team), or all of them
 *     if `user` is no longer a manager.
 * Must run in the same transaction as the User write.
 */
export const syncProfileWithUserBranches = async (
  user: BranchOwner,
  session?: ClientSession,
) => {
  const result = {
    profileBranchChanged: false,
    reportingManagerCleared: false,
    reportsDetached: 0,
  };

  // Head has global access; a user with no branches has nothing to sync to.
  if (user.role !== ROLES.HEAD && user.branches.length > 0) {
    const profile = await EmployeeProfile.findOne({ user: user._id }).session(
      session ?? null,
    );

    if (profile) {
      const currentBranchId = profile.branch?.toString();
      const targetBranchId = resolveProfileBranch(
        user,
        undefined,
        currentBranchId,
      );

      if (targetBranchId !== currentBranchId) {
        profile.branch = new Types.ObjectId(targetBranchId);
        result.profileBranchChanged = true;

        if (
          profile.reportingManager &&
          !(await managerBelongsToBranch(
            profile.reportingManager,
            targetBranchId,
            session,
          ))
        ) {
          profile.reportingManager = undefined;
          result.reportingManagerCleared = true;
        }

        await profile.save({ session });
      }
    }
  }

  // Only managers can be reporting managers (see employee.service), so a
  // non-manager loses all their reports; a manager keeps those in-branch.
  const detached = await EmployeeProfile.updateMany(
    user.role === ROLES.MANAGER
      ? { reportingManager: user._id, branch: { $nin: user.branches } }
      : { reportingManager: user._id },
    { $unset: { reportingManager: "" } },
    { session },
  );
  result.reportsDetached = detached.modifiedCount;

  return result;
};
