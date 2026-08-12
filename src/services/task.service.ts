import mongoose from "mongoose";

import { Task, type ITask } from "../models/Task.js";
import { TASK_PRIORITY, type TaskPriority } from "../constants/taskPriority.js";
import { User } from "../models/User.js";
import { Lead } from "../models/Lead.js";

import { ROLES } from "../constants/roles.js";

import { AppError } from "../utils/AppError.js";

interface CreateTaskInput {
  title: string;
  description?: string;
  lead?: string;
  assignedTo: string;
  priority?: TaskPriority;
  dueDate?: string;
  remarks?: string;
}

export const createTask = async (
  data: CreateTaskInput,
  creatorId: string,
): Promise<ITask> => {
  if (!mongoose.Types.ObjectId.isValid(data.assignedTo)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  const creator = await User.findById(creatorId)
    .select("_id role branches isActive")
    .lean();

  if (!creator) {
    throw new AppError("Creator account not found", 404, "CREATOR_NOT_FOUND");
  }

  if (!creator.isActive) {
    throw new AppError("Creator account is inactive", 403, "CREATOR_INACTIVE");
  }

  const employee = await User.findById(data.assignedTo)
    .select("_id name email role branches isActive")
    .lean();

  if (!employee) {
    throw new AppError(
      "Assigned employee not found",
      404,
      "EMPLOYEE_NOT_FOUND",
    );
  }

  if (!employee.isActive) {
    throw new AppError(
      "Cannot assign task to an inactive employee",
      400,
      "EMPLOYEE_INACTIVE",
    );
  }

  if (employee.role !== ROLES.EMPLOYEE) {
    throw new AppError(
      "Tasks can only be assigned to employees",
      400,
      "INVALID_ASSIGNEE_ROLE",
    );
  }

  let branchId: string;

  /*
   * Head can work across all branches.
   * For Admin / Manager, the branch must come
   * from the employee's branch relationship.
   */

  const employeeBranches = (employee.branches || []).map((branch) =>
    branch.toString(),
  );

  if (employeeBranches.length === 0) {
    throw new AppError(
      "Employee is not assigned to any branch",
      400,
      "EMPLOYEE_NO_BRANCH",
    );
  }

  if (creator.role === ROLES.HEAD) {
    if (employeeBranches.length > 1) {
      throw new AppError(
        "Employee must have a single working branch for task assignment",
        400,
        "AMBIGUOUS_EMPLOYEE_BRANCH",
      );
    }

    const employeeBranch = employeeBranches[0];

    if (!employeeBranch) {
      throw new AppError(
        "Employee branch could not be determined",
        400,
        "EMPLOYEE_BRANCH_NOT_FOUND",
      );
    }

    branchId = employeeBranch;
  } else {
    const creatorBranches = (creator.branches || []).map((branch) =>
      branch.toString(),
    );

    const matchingBranch = employeeBranches.find((branch) =>
      creatorBranches.includes(branch),
    );

    if (!matchingBranch) {
      throw new AppError(
        "Employee does not belong to your branch",
        403,
        "CROSS_BRANCH_ASSIGNMENT",
      );
    }

    branchId = matchingBranch;
  }

  /*
   * Validate lead if task is linked to a lead.
   */

  if (data.lead) {
    if (!mongoose.Types.ObjectId.isValid(data.lead)) {
      throw new AppError("Invalid lead ID", 400, "INVALID_LEAD_ID");
    }

    const lead = await Lead.findOne({
      _id: data.lead,
      isDeleted: false,
    })
      .select("_id branch")
      .lean();

    if (!lead) {
      throw new AppError("Lead not found", 404, "LEAD_NOT_FOUND");
    }

    if (lead.branch.toString() !== branchId) {
      throw new AppError(
        "Lead does not belong to the selected branch",
        403,
        "CROSS_BRANCH_LEAD",
      );
    }
  }

  const task = await Task.create({
    title: data.title,
    description: data.description,
    branch: new mongoose.Types.ObjectId(branchId),
    lead: data.lead ? new mongoose.Types.ObjectId(data.lead) : undefined,
    assignedTo: new mongoose.Types.ObjectId(data.assignedTo),
    assignedBy: new mongoose.Types.ObjectId(creatorId),
    priority: data.priority,
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    remarks: data.remarks,
    createdBy: new mongoose.Types.ObjectId(creatorId),
  });

  return task;
};
