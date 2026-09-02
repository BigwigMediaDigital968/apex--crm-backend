import { Request, Response } from "express";
import { StringeeNumber } from "../models/StringeeNumber.js";
import { EmployeeProfile } from "../models/EmployeeProfile.js";
import { User } from "../models/User.js";
import { ROLES } from "../constants/roles.js";
import { Types } from "mongoose";

// 1. Add new Stringee Phone Number to inventory
// export const createNumber = async (req: Request, res: Response) => {
//   try {
//     const { phoneNumber, label, branchId } = req.body;
//     const currentUser = (req as any).user;

//     if (!currentUser) {
//       return res
//         .status(401)
//         .json({ message: "Unauthorized: User payload missing" });
//     }

//     const userId = currentUser.id || currentUser._id;

//     const existing = await StringeeNumber.findOne({ phoneNumber });
//     if (existing) {
//       return res.status(400).json({ message: "Phone number already exists" });
//     }

//     let assignedBranch = branchId;
//     if (currentUser.role === ROLES.ADMIN) {
//       if (!currentUser.branches?.includes(branchId)) {
//         return res
//           .status(403)
//           .json({ message: "Cannot create number for unassigned branch" });
//       }
//     }

//     const numberDoc = await StringeeNumber.create({
//       phoneNumber,
//       label,
//       branch: assignedBranch || currentUser.branches?.[0],
//       createdBy: userId,
//     });

//     return res.status(201).json({ success: true, data: numberDoc });
//   } catch (error: any) {
//     return res.status(500).json({ message: error.message });
//   }
// };

// Helper to safely extract String branch IDs from array
const extractBranchIds = (branches: any[]): string[] => {
  if (!Array.isArray(branches)) return [];
  return branches.map((b) =>
    typeof b === "object" && b?._id ? b._id.toString() : b.toString()
  );
};

// 1. Add new Stringee Phone Number to inventory
export const createNumber = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, label, branchId } = req.body || {};
    const currentUser = (req as any).user;

    if (!currentUser) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User payload missing" });
    }

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const userId = currentUser.id || currentUser._id;

    const existing = await StringeeNumber.findOne({ phoneNumber });
    if (existing) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    // Use Types.ObjectId | undefined to match Mongoose Schema typing
    let assignedBranch: Types.ObjectId | undefined = undefined;
    const userRole = currentUser.role;

    if (userRole === ROLES.HEAD) {
      // HEAD: branchId is optional. Assign ObjectId if provided, otherwise leave undefined
      assignedBranch = branchId ? new Types.ObjectId(branchId) : undefined;
    } else if (userRole === ROLES.ADMIN) {
      if (!branchId) {
        return res.status(400).json({
          message: "Branch selection is required for Admin",
          availableBranches: currentUser.branches,
        });
      }

      const adminBranches = extractBranchIds(currentUser.branches);
      if (!adminBranches.includes(branchId.toString())) {
        return res.status(403).json({
          message: "Selected branch is not in your assigned branches list",
          availableBranches: currentUser.branches,
        });
      }

      assignedBranch = new Types.ObjectId(branchId);
    } else if (userRole === ROLES.MANAGER) {
      const managerBranches = extractBranchIds(currentUser.branches);
      if (!managerBranches.length) {
        return res
          .status(400)
          .json({ message: "Manager has no branch assigned" });
      }

      assignedBranch = new Types.ObjectId(managerBranches[0]);
    }

    const numberDoc = await StringeeNumber.create({
      phoneNumber,
      label,
      branch: assignedBranch,
      createdBy: new Types.ObjectId(userId),
    });

    return res.status(201).json({ success: true, data: numberDoc });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// 2. Update Stringee Number details
export const updateNumber = async (req: Request, res: Response) => {
  try {
    const { numberId } = req.params;
    const { phoneNumber, label, branchId, isActive } = req.body || {};
    const currentUser = (req as any).user;

    if (!currentUser) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User payload missing" });
    }

    const numberDoc = await StringeeNumber.findById(numberId);
    if (!numberDoc) {
      return res.status(404).json({ message: "Number entry not found" });
    }

    const userRole = currentUser.role;

    if (userRole === ROLES.ADMIN) {
      const adminBranches = extractBranchIds(currentUser.branches);
      if (
        numberDoc.branch &&
        !adminBranches.includes(numberDoc.branch.toString())
      ) {
        return res.status(403).json({
          message: "Cannot edit number outside your assigned branches",
        });
      }
    } else if (userRole === ROLES.MANAGER) {
      const managerBranches = extractBranchIds(currentUser.branches);
      if (
        numberDoc.branch &&
        !managerBranches.includes(numberDoc.branch.toString())
      ) {
        return res.status(403).json({
          message: "Cannot edit number outside your assigned branches",
        });
      }
    }

    if (phoneNumber && phoneNumber !== numberDoc.phoneNumber) {
      const existing = await StringeeNumber.findOne({
        phoneNumber,
        _id: { $ne: numberId },
      });
      if (existing) {
        return res.status(400).json({ message: "Phone number already in use" });
      }
      numberDoc.phoneNumber = phoneNumber;
    }

    if (label !== undefined) {
      numberDoc.label = label;
    }

    if (isActive !== undefined) {
      numberDoc.isActive = Boolean(isActive);
    }

    if (branchId !== undefined) {
      if (userRole === ROLES.HEAD) {
        numberDoc.branch = branchId ? new Types.ObjectId(branchId) : undefined;
      } else if (userRole === ROLES.ADMIN) {
        if (!branchId) {
          return res
            .status(400)
            .json({ message: "Branch selection is required for Admin" });
        }
        const adminBranches = extractBranchIds(currentUser.branches);
        if (!adminBranches.includes(branchId.toString())) {
          return res
            .status(403)
            .json({ message: "Cannot assign number to unassigned branch" });
        }
        numberDoc.branch = new Types.ObjectId(branchId);
      } else if (userRole === ROLES.MANAGER) {
        const managerBranches = extractBranchIds(currentUser.branches);
        if (managerBranches.length > 0) {
          numberDoc.branch = new Types.ObjectId(managerBranches[0]);
        }
      }
    }

    await numberDoc.save();

    return res.status(200).json({
      success: true,
      message: "Stringee number updated successfully",
      data: numberDoc,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// 2. Fetch inventory numbers (Role Scoped)
export const getNumbers = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    let filter: any = {};

    if (
      currentUser.role === ROLES.ADMIN ||
      currentUser.role === ROLES.MANAGER
    ) {
      filter.branch = { $in: currentUser.branches };
    }

    const numbers = await StringeeNumber.find(filter)
      .populate("assignedTo", "name email role")
      .populate("branch", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: numbers });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// 3. Assign / Unassign number to an Employee
export const assignNumber = async (req: Request, res: Response) => {
  try {
    const { numberId } = req.params;
    const { targetUserId } = req.body; // Pass null to unassign
    const currentUser = (req as any).user;

    const numberDoc = await StringeeNumber.findById(numberId);
    if (!numberDoc) {
      return res.status(404).json({ message: "Number entry not found" });
    }

    if (targetUserId) {
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }

      // Hierarchy validation
      if (currentUser.role === ROLES.ADMIN) {
        const hasCommonBranch = targetUser.branches.some((b) =>
          currentUser.branches
            .map((cb: any) => cb.toString())
            .includes(b.toString()),
        );
        if (!hasCommonBranch) {
          return res
            .status(403)
            .json({ message: "Cannot assign to user outside your branch" });
        }
      }

      if (currentUser.role === ROLES.MANAGER) {
        const empProfile = await EmployeeProfile.findOne({
          user: targetUserId,
        });
        if (
          empProfile?.reportingManager?.toString() !==
          currentUser._id.toString()
        ) {
          return res
            .status(403)
            .json({ message: "Can only assign to direct reportees" });
        }
      }

      // Ensure target employee doesn't already have another number assigned
      await StringeeNumber.updateMany(
        { assignedTo: targetUserId },
        { $unset: { assignedTo: 1, assignedBy: 1, assignedAt: 1 } },
      );
    }

    numberDoc.assignedTo = targetUserId || undefined;
    numberDoc.assignedBy = targetUserId ? currentUser._id : undefined;
    numberDoc.assignedAt = targetUserId ? new Date() : undefined;

    await numberDoc.save();

    return res.status(200).json({
      success: true,
      message: targetUserId
        ? "Number assigned successfully"
        : "Number unassigned successfully",
      data: numberDoc,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
