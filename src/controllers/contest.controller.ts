import { Request, Response, NextFunction } from "express";
import {
  createContest,
  getActiveContestsForUser,
  getContestDetailsForUser,
  updateContest,
  toggleContestStatus,
  getAllContestsForAdmin,
  joinContest,
  withdrawFromContest,
  getContestParticipants,
  getContestLeaderboard,
  removeContestParticipant,
} from "../services/contest.service.js";
import { AppError } from "../utils/AppError.js";

export const launchContestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const contest = await createContest(req.user, req.body, req.file);

    return res.status(201).json({ success: true, data: contest });
  } catch (err) {
    next(err);
  }
};

export const getAllContestsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 10;
    const search = req.query.search ? (req.query.search as string) : undefined;
    const branchId = req.query.branchId
      ? (req.query.branchId as string)
      : undefined;

    let isActive: boolean | undefined = undefined;
    if (req.query.isActive !== undefined) {
      isActive = req.query.isActive === "true";
    }

    const result = await getAllContestsForAdmin(req.user, {
      page,
      limit,
      search,
      isActive,
      branchId,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getMyBranchContestsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const contests = await getActiveContestsForUser(req.user);
    return res.status(200).json({ success: true, data: contests });
  } catch (err) {
    next(err);
  }
};

export const getContestByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const contest = await getContestDetailsForUser(
      req.params.id as string,
      req.user,
    );
    return res.status(200).json({ success: true, data: contest });
  } catch (err) {
    next(err);
  }
};

export const updateContestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const contestId = req.params.id as string;
    if (!contestId) {
      throw new AppError("Contest ID is required", 400, "ID_REQUIRED");
    }

    const updatedContest = await updateContest(
      contestId,
      req.user,
      req.body,
      req.file,
    );

    return res.status(200).json({ success: true, data: updatedContest });
  } catch (err) {
    next(err);
  }
};

export const toggleContestStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const contestId = req.params.id as string;
    if (!contestId) {
      throw new AppError("Contest ID is required", 400, "ID_REQUIRED");
    }

    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      throw new AppError(
        "isActive field must be a boolean",
        400,
        "INVALID_INPUT",
      );
    }

    const contest = await toggleContestStatus(contestId, req.user, isActive);

    return res.status(200).json({
      success: true,
      message: `Contest ${isActive ? "activated" : "deactivated"} successfully`,
      data: contest,
    });
  } catch (err) {
    next(err);
  }
};

// POST /contests/:id/join — "I'm in"
export const joinContestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const participant = await joinContest(req.params.id as string, req.user);

    return res.status(201).json({
      success: true,
      message: "You have joined the contest",
      data: participant,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /contests/:id/join — withdraw before the join deadline
export const withdrawFromContestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    await withdrawFromContest(req.params.id as string, req.user);

    return res.status(200).json({
      success: true,
      message: "You have withdrawn from the contest",
    });
  } catch (err) {
    next(err);
  }
};

// GET /contests/:id/participants
export const getContestParticipantsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const participants = await getContestParticipants(
      req.params.id as string,
      req.user,
    );

    return res.status(200).json({ success: true, data: participants });
  } catch (err) {
    next(err);
  }
};

// DELETE /contests/:id/participants/:userId — Head/Admin removes a participant
export const removeContestParticipantHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    await removeContestParticipant(
      req.params.id as string,
      req.params.userId as string,
    );

    return res.status(200).json({
      success: true,
      message: "Participant removed from the contest",
    });
  } catch (err) {
    next(err);
  }
};

// GET /contests/:id/leaderboard
export const getContestLeaderboardHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

    const leaderboard = await getContestLeaderboard(
      req.params.id as string,
      req.user,
    );

    return res.status(200).json({ success: true, data: leaderboard });
  } catch (err) {
    next(err);
  }
};
