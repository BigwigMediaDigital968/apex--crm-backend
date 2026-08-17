import mongoose from "mongoose";

import { Task, type ITask } from "../models/Task.js";
import { TASK_STATUS } from "../constants/taskStatus.js";
import { TASK_UPDATE_FIELDS } from "../constants/taskPermissions.js";
import { TASK_PRIORITY, type TaskPriority } from "../constants/taskPriority.js";
import { User } from "../models/User.js";
import { Lead } from "../models/Lead.js";
import { ROLES } from "../constants/roles.js";
import { AppError } from "../utils/AppError.js";
import { AuthenticatedUser } from "../types/auth.js";
import { createTaskActivity } from "./task-activity.service.js";
import { TASK_ACTIVITY_TYPE } from "../constants/taskActivity.js";

interface CreateTaskInput {
  title: string;
  description?: string;
  lead?: string;
  assignedTo: string;
  priority?: TaskPriority;
  dueDate?: string;
  remarks?: string;
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  remarks?: string;
  completedAt?: string | null;
  assignedTo?: string;
  branch?: string;
  lead?: string | null;
}

export const createTask = async (
  data: CreateTaskInput,
  creatorId: string,
): Promise<ITask> => {
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    throw new AppError("Invalid creator ID", 400, "INVALID_CREATOR_ID");
  }

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

  // 1. Record task creation activity
  await createTaskActivity({
    task: task._id.toString(),
    activityType: TASK_ACTIVITY_TYPE.CREATED,
    performedBy: creatorId,
    branch: task.branch.toString(),
    metadata: {
      title: task.title,
      assignedTo: task.assignedTo.toString(),
      priority: task.priority,
      status: task.status,
    },
  });

  // 2. Record initial task assignment activity
  await createTaskActivity({
    task: task._id.toString(),
    activityType: TASK_ACTIVITY_TYPE.ASSIGNED,
    performedBy: creatorId,
    branch: task.branch.toString(),
    newValue: task.assignedTo.toString(),
    metadata: {
      assignedTo: task.assignedTo.toString(),
    },
  });

  return task;
};

export const getTasks = async (user: AuthenticatedUser) => {
  if (!user || !user.role) {
    throw new AppError(
      "Authentication required",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const filter: Record<string, unknown> = { isDeleted: false };

  switch (user.role) {
    case ROLES.HEAD:
      break;

    case ROLES.EMPLOYEE: {
      if (!mongoose.Types.ObjectId.isValid(user.id)) {
        throw new AppError("Invalid user ID", 400, "INVALID_USER_ID");
      }
      filter.assignedTo = new mongoose.Types.ObjectId(user.id);
      break;
    }

    case ROLES.ADMIN:
    case ROLES.MANAGER: {
      const userBranches = user.branches || [];

      if (userBranches.length === 0) {
        throw new AppError(
          "You are not assigned to any branches. Access denied.",
          403,
          "NO_BRANCH_ASSIGNED",
        );
      }

      const branchIds = userBranches
        .map((b) => (typeof b === "object" && "_id" in b ? (b as any)._id : b))
        .filter((id) => mongoose.Types.ObjectId.isValid(id.toString()))
        .map((id) => new mongoose.Types.ObjectId(id.toString()));

      if (branchIds.length === 0) {
        throw new AppError(
          "No valid branch IDs found for user",
          400,
          "INVALID_BRANCH_IDS",
        );
      }

      filter.branch = { $in: branchIds };
      break;
    }

    default:
      throw new AppError(
        `Role '${user.role}' is not authorized to access tasks`,
        403,
        "UNAUTHORIZED_ROLE",
      );
  }

  return Task.find(filter)
    .populate("assignedTo", "name email role")
    .populate("assignedBy", "name email role")
    .populate("lead", "name phone email status")
    .populate("branch", "name code")
    .sort({ createdAt: -1 });
};

export const getTaskById = async (taskId: string, user: AuthenticatedUser) => {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
  }

  const task = await Task.findOne({
    _id: taskId,
    isDeleted: false,
  })
    .populate("assignedTo", "name email role branches")
    .populate("assignedBy", "name email role")
    .populate("createdBy", "name email role")
    .populate("lead", "name phone email status")
    .populate("branch", "name code")
    .lean();

  if (!task) {
    throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  }

  /*
   * HEAD can access every task.
   */
  if (user.role === ROLES.HEAD) {
    return task;
  }

  const taskBranchId = task.branch._id.toString();

  /*
   * EMPLOYEE can only access tasks assigned to themselves.
   */
  if (user.role === ROLES.EMPLOYEE) {
    if (task.assignedTo._id.toString() !== user.id) {
      throw new AppError(
        "You do not have access to this task",
        403,
        "TASK_ACCESS_DENIED",
      );
    }

    return task;
  }

  /*
   * ADMIN / MANAGER can access tasks
   * belonging to their assigned branches.
   */
  const userBranchIds = (user.branches || []).map((branchId) =>
    branchId.toString(),
  );

  if (!userBranchIds.includes(taskBranchId)) {
    throw new AppError(
      "You do not have access to this task",
      403,
      "TASK_ACCESS_DENIED",
    );
  }

  return task;
};

export const updateTask = async (
  taskId: string,
  data: UpdateTaskInput,
  user: AuthenticatedUser,
) => {
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
  }

  const task = await Task.findOne({
    _id: taskId,
    isDeleted: false,
  });

  if (!task) {
    throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  }

  /*
   * ------------------------------------------------
   * 1. Capture initial values before mutations
   * ------------------------------------------------
   */
  const previousStatus = task.status;
  const previousAssignedTo = task.assignedTo
    ? task.assignedTo.toString()
    : undefined;
  const previousPriority = task.priority;
  const previousDueDate = task.dueDate ? new Date(task.dueDate) : undefined;
  const previousRemarks = task.remarks;

  /*
   * ------------------------------------------------
   * 2. Verify user has access to this task
   * ------------------------------------------------
   */

  if (user.role === ROLES.EMPLOYEE) {
    if (task.assignedTo.toString() !== user.id) {
      throw new AppError(
        "You do not have access to this task",
        403,
        "TASK_ACCESS_DENIED",
      );
    }
  }

  if (user.role !== ROLES.HEAD && user.role !== ROLES.EMPLOYEE) {
    const userBranchIds = (user.branches || []).map((branchId) =>
      branchId.toString(),
    );

    if (!userBranchIds.includes(task.branch.toString())) {
      throw new AppError(
        "You do not have access to this task",
        403,
        "TASK_ACCESS_DENIED",
      );
    }
  }

  /*
   * ------------------------------------------------
   * 3. Determine allowed fields
   * ------------------------------------------------
   */

  const allowedFields = TASK_UPDATE_FIELDS[user.role];

  /*
   * ------------------------------------------------
   * 4. Prevent unauthorized fields
   * ------------------------------------------------
   */

  const incomingFields = Object.keys(data);

  const unauthorizedFields = incomingFields.filter(
    (field) => !(allowedFields as readonly string[]).includes(field),
  );

  if (unauthorizedFields.length > 0) {
    throw new AppError(
      `You are not allowed to update: ${unauthorizedFields.join(", ")}`,
      403,
      "TASK_FIELD_UPDATE_DENIED",
    );
  }

  /*
   * ------------------------------------------------
   * 5. Validate branch change
   * ------------------------------------------------
   */

  if (data.branch) {
    if (!mongoose.Types.ObjectId.isValid(data.branch)) {
      throw new AppError("Invalid branch ID", 400, "INVALID_BRANCH_ID");
    }

    const branchAllowed =
      user.role === ROLES.HEAD ||
      user.branches.map((id) => id.toString()).includes(data.branch);

    if (!branchAllowed) {
      throw new AppError(
        "You cannot move a task to this branch",
        403,
        "BRANCH_ACCESS_DENIED",
      );
    }
  }

  /*
   * ------------------------------------------------
   * 6. Validate assigned employee
   * ------------------------------------------------
   */

  if (data.assignedTo) {
    if (!mongoose.Types.ObjectId.isValid(data.assignedTo)) {
      throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
    }

    const employee = await User.findOne({
      _id: data.assignedTo,
      isActive: true,
    }).select("_id role branches");

    if (!employee) {
      throw new AppError(
        "Assigned employee not found or inactive",
        404,
        "EMPLOYEE_NOT_FOUND",
      );
    }

    const employeeBranchIds = employee.branches.map((branchId) =>
      branchId.toString(),
    );

    /*
     * HEAD can assign across branches.
     */
    if (user.role === ROLES.HEAD) {
      // allowed
    } else {
      /*
       * Admin / Manager must assign within
       * a branch they control.
       */
      const hasCommonBranch = employeeBranchIds.some((branchId) =>
        user.branches.map((id) => id.toString()).includes(branchId),
      );

      if (!hasCommonBranch) {
        throw new AppError(
          "Employee does not belong to your branch",
          403,
          "EMPLOYEE_BRANCH_ACCESS_DENIED",
        );
      }
    }
  }

  /*
   * ------------------------------------------------
   * 7. Apply updates to the task model
   * ------------------------------------------------
   */

  if (data.title !== undefined) {
    task.title = data.title;
  }

  if (data.description !== undefined) {
    task.description = data.description;
  }

  if (data.priority !== undefined) {
    task.priority = data.priority as typeof task.priority;
  }

  if (data.status !== undefined) {
    task.status = data.status as typeof task.status;

    if (
      data.status === TASK_STATUS.COMPLETED &&
      previousStatus !== TASK_STATUS.COMPLETED
    ) {
      task.completedAt = new Date();
    }

    if (data.status !== TASK_STATUS.COMPLETED) {
      task.completedAt = undefined;
    }
  }

  if (data.dueDate !== undefined) {
    task.dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
  }

  if (data.remarks !== undefined) {
    task.remarks = data.remarks;
  }

  if (data.completedAt !== undefined) {
    task.completedAt = data.completedAt
      ? new Date(data.completedAt)
      : undefined;
  }

  if (data.assignedTo !== undefined) {
    task.assignedTo = new mongoose.Types.ObjectId(data.assignedTo);
  }

  if (data.branch !== undefined) {
    task.branch = new mongoose.Types.ObjectId(data.branch);
  }

  if (data.lead !== undefined) {
    task.lead = data.lead ? new mongoose.Types.ObjectId(data.lead) : undefined;
  }

  await task.save();

  /*
   * ------------------------------------------------
   * 8. Record Task Activity Logs
   * ------------------------------------------------
   */

  // A. Status Change / Completion Activity
  if (data.status !== undefined && previousStatus !== data.status) {
    await createTaskActivity({
      task: task._id.toString(),
      activityType:
        data.status === TASK_STATUS.COMPLETED
          ? TASK_ACTIVITY_TYPE.COMPLETED
          : TASK_ACTIVITY_TYPE.STATUS_CHANGED,
      performedBy: user.id,
      branch: task.branch.toString(),
      previousValue: previousStatus,
      newValue: data.status,
      metadata: {
        taskTitle: task.title,
      },
    });
  }

  // B. Task Reassignment Activity
  const newAssignedTo = task.assignedTo.toString();

  if (previousAssignedTo && previousAssignedTo !== newAssignedTo) {
    await createTaskActivity({
      task: task._id.toString(),
      activityType: TASK_ACTIVITY_TYPE.REASSIGNED,
      performedBy: user.id,
      branch: task.branch.toString(),
      previousValue: previousAssignedTo,
      newValue: newAssignedTo,
      metadata: {
        reason: "Task reassigned",
      },
    });
  }

  // C. Priority Change Activity
  if (data.priority !== undefined && previousPriority !== data.priority) {
    await createTaskActivity({
      task: task._id.toString(),
      activityType: TASK_ACTIVITY_TYPE.PRIORITY_CHANGED,
      performedBy: user.id,
      branch: task.branch.toString(),
      previousValue: previousPriority,
      newValue: data.priority,
    });
  }

  // D. Due Date Change Activity
  if (data.dueDate !== undefined) {
    const newDueDate = data.dueDate ? new Date(data.dueDate) : undefined;

    const previousTime = previousDueDate ? previousDueDate.getTime() : null;
    const newTime = newDueDate ? newDueDate.getTime() : null;

    if (previousTime !== newTime) {
      await createTaskActivity({
        task: task._id.toString(),
        activityType: TASK_ACTIVITY_TYPE.DUE_DATE_CHANGED,
        performedBy: user.id,
        branch: task.branch.toString(),
        previousValue: previousDueDate
          ? previousDueDate.toISOString()
          : undefined,
        newValue: newDueDate ? newDueDate.toISOString() : undefined,
      });
    }
  }

  // E. Remarks Added / Changed Activity
  if (data.remarks !== undefined) {
    await createTaskActivity({
      task: task._id.toString(),
      activityType: TASK_ACTIVITY_TYPE.REMARK_ADDED,
      performedBy: user.id,
      branch: task.branch.toString(),
      previousValue: previousRemarks || undefined,
      newValue: data.remarks,
    });
  }

  return task;
};
