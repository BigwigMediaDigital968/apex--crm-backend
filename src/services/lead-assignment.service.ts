import mongoose from "mongoose";

import { LeadAssignmentHistory } from "../models/LeadAssignmentHistory.js";
import { Lead } from "../models/Lead.js";
import { User } from "../models/User.js";
import { ROLES } from "../constants/roles.js";
import { AppError } from "../utils/AppError.js";

export const assignLead = async ({
  leadId,
  employeeId,
  actorId,
}: {
  leadId: string;
  employeeId: string;
  actorId: string;
}) => {
  if (!mongoose.Types.ObjectId.isValid(leadId)) {
    throw new AppError("Invalid lead ID", 400, "INVALID_LEAD_ID");
  }

  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  const lead = await Lead.findOne({
    _id: leadId,
    isDeleted: false,
  });

  if (!lead) {
    throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
  }

  const employee = await User.findOne({
    _id: employeeId,
    isActive: true,
  })
    .select("_id name email role branches isActive")
    .lean();

  if (!employee) {
    throw new AppError(
      "Employee not found or inactive",
      404,
      "EMPLOYEE_NOT_FOUND",
    );
  }

  if (employee.role !== ROLES.EMPLOYEE) {
    throw new AppError(
      "Lead can only be assigned to an employee",
      400,
      "INVALID_ASSIGNMENT_TARGET",
    );
  }

  const employeeBelongsToBranch = employee.branches.some(
    (branch) => branch.toString() === lead.branch.toString(),
  );

  if (!employeeBelongsToBranch) {
    throw new AppError(
      "Employee does not belong to the lead's branch",
      403,
      "CROSS_BRANCH_ASSIGNMENT",
    );
  }

  const actor = await User.findById(actorId)
    .select("_id role branches isActive")
    .lean();

  if (!actor) {
    throw new AppError("Assigning user not found", 401, "ACTOR_NOT_FOUND");
  }

  if (!actor.isActive) {
    throw new AppError("Your account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  /*
   * HEAD can assign across branches.
   */
  if (actor.role !== ROLES.HEAD) {
    const actorHasBranchAccess = actor.branches.some(
      (branch) => branch.toString() === lead.branch.toString(),
    );

    if (!actorHasBranchAccess) {
      throw new AppError(
        "You do not have access to this lead's branch",
        403,
        "BRANCH_ACCESS_DENIED",
      );
    }
  }

  // ✅ Store the previous assignee BEFORE mutating lead.assignedTo
const previousAssignee = lead.assignedTo || undefined;
const now = new Date();

// ✅ Update lead fields
lead.assignedTo = new mongoose.Types.ObjectId(employeeId);
lead.assignedBy = new mongoose.Types.ObjectId(actorId);
lead.assignedAt = now;

// ✅ Save lead without session/transaction
await lead.save();

// ✅ Save history without session/transaction
await LeadAssignmentHistory.create({
  lead: lead._id,
  assignedTo: new mongoose.Types.ObjectId(employeeId),
  assignedBy: new mongoose.Types.ObjectId(actorId),
  branch: lead.branch,
  previousAssignee,
  assignedAt: now,
});

return lead;
};