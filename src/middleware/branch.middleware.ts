import type {
  NextFunction,
  Request,
  Response
} from "express";

import {
  hasBranchAccess
} from "../utils/branchAccess.js";

import { AppError } from "../utils/AppError.js";

export const requireBranchAccess = (
  branchIdResolver: (
    req: Request
  ) => string | undefined
) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return next(
        new AppError(
          "Authentication required",
          401,
          "AUTHENTICATION_REQUIRED"
        )
      );
    }

    const branchId =
      branchIdResolver(req);

    if (!branchId) {
      return next(
        new AppError(
          "Branch ID is required",
          400,
          "BRANCH_ID_REQUIRED"
        )
      );
    }

    if (
      !hasBranchAccess(
        req.user,
        branchId
      )
    ) {
      return next(
        new AppError(
          "You do not have access to this branch",
          403,
          "BRANCH_ACCESS_DENIED"
        )
      );
    }

    next();
  };
};