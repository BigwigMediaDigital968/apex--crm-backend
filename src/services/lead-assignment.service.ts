// import mongoose from "mongoose";

// import { LeadAssignmentHistory } from "../models/LeadAssignmentHistory.js";
// import { Lead } from "../models/Lead.js";
// import { User } from "../models/User.js";
// import { ROLES } from "../constants/roles.js";
// import { AppError } from "../utils/AppError.js";

// export const assignLead = async ({
//   leadId,
//   employeeId,
//   actorId,
// }: {
//   leadId: string;
//   employeeId: string;
//   actorId: string;
// }) => {
//   if (!mongoose.Types.ObjectId.isValid(leadId)) {
//     throw new AppError("Invalid lead ID", 400, "INVALID_LEAD_ID");
//   }

//   if (!mongoose.Types.ObjectId.isValid(employeeId)) {
//     throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
//   }

//   const lead = await Lead.findOne({
//     _id: leadId,
//     isDeleted: false,
//   });

//   if (!lead) {
//     throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
//   }

//   const employee = await User.findOne({
//     _id: employeeId,
//     isActive: true,
//   })
//     .select("_id name email role branches isActive")
//     .lean();

//   if (!employee) {
//     throw new AppError(
//       "Employee not found or inactive",
//       404,
//       "EMPLOYEE_NOT_FOUND",
//     );
//   }

//   if (employee.role !== ROLES.EMPLOYEE) {
//     throw new AppError(
//       "Lead can only be assigned to an employee",
//       400,
//       "INVALID_ASSIGNMENT_TARGET",
//     );
//   }

//   const employeeBelongsToBranch = employee.branches.some(
//     (branch) => branch.toString() === lead.branch.toString(),
//   );

//   if (!employeeBelongsToBranch) {
//     throw new AppError(
//       "Employee does not belong to the lead's branch",
//       403,
//       "CROSS_BRANCH_ASSIGNMENT",
//     );
//   }

//   const actor = await User.findById(actorId)
//     .select("_id role branches isActive")
//     .lean();

//   if (!actor) {
//     throw new AppError("Assigning user not found", 401, "ACTOR_NOT_FOUND");
//   }

//   if (!actor.isActive) {
//     throw new AppError("Your account is inactive", 403, "ACCOUNT_INACTIVE");
//   }

//   /*
//    * HEAD can assign across branches.
//    */
//   if (actor.role !== ROLES.HEAD) {
//     const actorHasBranchAccess = actor.branches.some(
//       (branch) => branch.toString() === lead.branch.toString(),
//     );

//     if (!actorHasBranchAccess) {
//       throw new AppError(
//         "You do not have access to this lead's branch",
//         403,
//         "BRANCH_ACCESS_DENIED",
//       );
//     }
//   }

//   // ✅ Store the previous assignee BEFORE mutating lead.assignedTo
// const previousAssignee = lead.assignedTo || undefined;
// const now = new Date();

// // ✅ Update lead fields
// lead.assignedTo = new mongoose.Types.ObjectId(employeeId);
// lead.assignedBy = new mongoose.Types.ObjectId(actorId);
// lead.assignedAt = now;

// // ✅ Save lead without session/transaction
// await lead.save();

// // ✅ Save history without session/transaction
// await LeadAssignmentHistory.create({
//   lead: lead._id,
//   assignedTo: new mongoose.Types.ObjectId(employeeId),
//   assignedBy: new mongoose.Types.ObjectId(actorId),
//   branch: lead.branch,
//   previousAssignee,
//   assignedAt: now,
// });

// return lead;
// };


import mongoose from "mongoose";
import { LeadAssignmentHistory } from "../models/LeadAssignmentHistory.js";
import { Lead } from "../models/Lead.js";
import { User } from "../models/User.js";
import { ROLES } from "../constants/roles.js";
import { AppError } from "../utils/AppError.js";

// Single Assignment Service
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

  const lead = await Lead.findOne({ _id: leadId, isDeleted: false });
  if (!lead) {
    throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
  }

  const employee = await User.findOne({ _id: employeeId, isActive: true })
    .select("_id name email role branches isActive")
    .lean();

  if (!employee) {
    throw new AppError("Employee not found or inactive", 404, "EMPLOYEE_NOT_FOUND");
  }

  if (employee.role !== ROLES.EMPLOYEE) {
    throw new AppError("Lead can only be assigned to an employee", 400, "INVALID_ASSIGNMENT_TARGET");
  }

  const actor = await User.findById(actorId).select("_id role branches isActive").lean();
  if (!actor) {
    throw new AppError("Assigning user not found", 401, "ACTOR_NOT_FOUND");
  }
  if (!actor.isActive) {
    throw new AppError("Your account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  const isHead = actor.role === ROLES.HEAD;

  // Validate branch assignment rules ONLY if actor is NOT HEAD
  if (!isHead) {
    const employeeBelongsToBranch = employee.branches.some(
      (branch) => branch.toString() === lead.branch.toString()
    );
    if (!employeeBelongsToBranch) {
      throw new AppError("Employee does not belong to the lead's branch", 403, "CROSS_BRANCH_ASSIGNMENT");
    }

    const actorHasBranchAccess = actor.branches.some(
      (branch) => branch.toString() === lead.branch.toString()
    );
    if (!actorHasBranchAccess) {
      throw new AppError("You do not have access to this lead's branch", 403, "BRANCH_ACCESS_DENIED");
    }
  }

  const previousAssignee = lead.assignedTo || undefined;
  const now = new Date();

  lead.assignedTo = new mongoose.Types.ObjectId(employeeId);
  lead.assignedBy = new mongoose.Types.ObjectId(actorId);
  lead.assignedAt = now;

  await lead.save();

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

// Bulk Assignment Service
export const assignLeadsBulk = async ({
  leadIds,
  employeeId,
  actorId,
}: {
  leadIds: string[];
  employeeId: string;
  actorId: string;
}) => {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    throw new AppError("Lead IDs must be a non-empty array", 400, "INVALID_LEAD_IDS");
  }

  const validLeadIds = leadIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (validLeadIds.length !== leadIds.length) {
    throw new AppError("One or more Lead IDs are invalid", 400, "INVALID_LEAD_IDS");
  }

  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  const actor = await User.findById(actorId).select("_id role branches isActive").lean();
  if (!actor || !actor.isActive) {
    throw new AppError("Assigning user is invalid or inactive", 403, "UNAUTHORIZED_ACTOR");
  }

  const employee = await User.findOne({ _id: employeeId, isActive: true })
    .select("_id name email role branches isActive")
    .lean();

  if (!employee || employee.role !== ROLES.EMPLOYEE) {
    throw new AppError("Target employee is invalid or inactive", 400, "INVALID_EMPLOYEE");
  }

  const isHead = actor.role === ROLES.HEAD;

  const leads = await Lead.find({ _id: { $in: validLeadIds }, isDeleted: false });
  if (leads.length === 0) {
    throw new AppError("No valid leads found for assignment", 404, "LEADS_NOT_FOUND");
  }

  const now = new Date();
  const bulkOps = [];
  const historyDocs = [];

  for (const lead of leads) {
    if (!isHead) {
      const employeeBelongs = employee.branches.some(
        (b) => b.toString() === lead.branch.toString()
      );
      const actorHasAccess = actor.branches.some(
        (b) => b.toString() === lead.branch.toString()
      );

      if (!employeeBelongs || !actorHasAccess) {
        throw new AppError(
          `Cross-branch assignment denied for lead ID: ${lead._id}`,
          403,
          "BRANCH_ACCESS_DENIED"
        );
      }
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: lead._id },
        update: {
          $set: {
            assignedTo: new mongoose.Types.ObjectId(employeeId),
            assignedBy: new mongoose.Types.ObjectId(actorId),
            assignedAt: now,
          },
        },
      },
    });

    historyDocs.push({
      lead: lead._id,
      assignedTo: new mongoose.Types.ObjectId(employeeId),
      assignedBy: new mongoose.Types.ObjectId(actorId),
      branch: lead.branch,
      previousAssignee: lead.assignedTo || undefined,
      assignedAt: now,
    });
  }

  await Lead.bulkWrite(bulkOps);
  await LeadAssignmentHistory.insertMany(historyDocs);

  return { assignedCount: leads.length, leadIds: leads.map((l) => l._id) };
};