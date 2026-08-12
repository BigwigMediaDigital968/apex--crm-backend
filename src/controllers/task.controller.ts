import type { NextFunction, Request, Response } from "express";

import type { ITask } from "../models/Task.js";

import { createTask } from "../services/task.service.js";

import { createAuditLog } from "../services/audit.service.js";


export const createTaskController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      });
    }

   const task: ITask = await createTask(
  req.body,
  req.user.id,
);

    await createAuditLog({
      actor: req.user.id,
      action: "TASK_CREATED",
      entity: "Task",
      entityId: task._id.toString(),
      branch: task.branch.toString(),
      metadata: {
        title: task.title,
        assignedTo: task.assignedTo.toString(),
        lead: task.lead
          ? task.lead.toString()
          : undefined,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    next(error);
  }
};