/**
 * One-off backfill for the User ↔ EmployeeProfile branch invariant (see
 * services/employeeBranchSync.service.ts). Finds profiles whose branch is not
 * one of their user's branches, and reporting managers that are no longer
 * valid, and repairs them.
 *
 *   npm run sync:employee-branches            # dry run — report only
 *   npm run sync:employee-branches -- --apply # write fixes
 */
import mongoose, { Types } from "mongoose";

import { env } from "../config/env.js";
import { ROLES, type Role } from "../constants/roles.js";
import { EmployeeProfile } from "../models/EmployeeProfile.js";
import { User } from "../models/User.js";
import {
  isSingleBranchRole,
  syncProfileWithUserBranches,
} from "../services/employeeBranchSync.service.js";
import { runTransaction } from "../utils/transaction.js";

interface LeanUser {
  _id: Types.ObjectId;
  email: string;
  role: Role;
  branches: Types.ObjectId[];
}

const apply = process.argv.includes("--apply");

const main = async () => {
  await mongoose.connect(env.mongoUri);
  console.log(
    `DB: ${mongoose.connection.db?.databaseName} — ${apply ? "APPLY" : "DRY RUN"}\n`,
  );

  const profiles = await EmployeeProfile.find()
    .select("user branch reportingManager employeeCode")
    .lean();
  const users = await User.find({
    _id: { $in: profiles.flatMap((p) => [p.user, p.reportingManager ?? []]) },
  })
    .select("email role branches")
    .lean<LeanUser[]>();
  const usersById = new Map(users.map((u) => [u._id.toString(), u]));

  // Users needing a sync: their own profile drifted, or someone reports to
  // them invalidly. syncProfileWithUserBranches fixes both for that user.
  const toSync = new Map<string, LeanUser>();
  let orphans = 0;

  for (const profile of profiles) {
    const user = usersById.get(profile.user.toString());
    if (!user) {
      orphans++;
      console.log(`! ${profile.employeeCode}: user ${profile.user} missing`);
      continue;
    }

    const branchIds = user.branches.map(String);
    const profileBranch = profile.branch?.toString();
    const drifted =
      user.role !== ROLES.HEAD &&
      branchIds.length > 0 &&
      (isSingleBranchRole(user.role)
        ? profileBranch !== branchIds[0]
        : !branchIds.includes(profileBranch));

    if (drifted) {
      console.log(
        `- ${user.email} (${user.role}): profile branch ${profileBranch} → user branches [${branchIds.join(", ")}]`,
      );
      toSync.set(user._id.toString(), user);
    }

    if (profile.reportingManager) {
      const manager = usersById.get(profile.reportingManager.toString());
      const managerValid =
        manager?.role === ROLES.MANAGER &&
        manager.branches.some((b) => b.toString() === profileBranch);
      // A drifted profile is re-checked against its new branch by the sync.
      if (!managerValid && !drifted) {
        console.log(
          `- ${user.email}: reporting manager ${manager?.email ?? profile.reportingManager} not a manager in branch ${profileBranch}`,
        );
        if (manager) toSync.set(manager._id.toString(), manager);
        else orphans++;
      }
    }
  }

  console.log(
    `\n${toSync.size} user(s) to sync, ${orphans} orphan reference(s) needing manual review.`,
  );

  if (apply) {
    for (const user of toSync.values()) {
      const result = await runTransaction((session) =>
        syncProfileWithUserBranches(user, session),
      );
      console.log(`✓ ${user.email}`, result);
    }
  } else if (toSync.size > 0) {
    console.log("Re-run with --apply to fix.");
  }

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
