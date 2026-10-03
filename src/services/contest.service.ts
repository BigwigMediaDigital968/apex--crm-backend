import { Types } from "mongoose";
import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";
import { Contest, type IContest } from "../models/Contest.js";
import { ContestParticipant } from "../models/ContestParticipant.js";
import { Branch } from "../models/Branch.js";
import { Revenue, REVENUE_STATUS } from "../models/Revenue.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { notify } from "./notification.service.js";
import { ROLES } from "../constants/roles.js";
import { NOTIFICATION_TYPES } from "../models/Notification.js";
import { AppError } from "../utils/AppError.js";
import type { AuthenticatedUser } from "../types/auth.js";

export const createContestSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().min(5),
  branches: z.preprocess(
    (val) => {
      // 1. If sent as JSON array or single value array
      if (Array.isArray(val)) return val;
      // 2. If sent as string (e.g. '["id1", "id2"]' or 'id1,id2' or 'id1')
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // Fallback for comma-separated values: "id1,id2"
          return val.split(",").map((item) => item.trim());
        }
        return [val.trim()];
      }
      return val;
    },
    z.array(z.string()).min(1, "At least one target branch is required"),
  ),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
  // Optional cut-off for "I'm in"; "" or null clears it (falls back to endDate)
  joinDeadline: z
    .union([z.string().datetime({ offset: true }), z.literal(""), z.null()])
    .optional(),
});

const assertValidContestDates = (
  startDate: Date,
  endDate: Date,
  joinDeadline?: Date,
) => {
  if (startDate >= endDate) {
    throw new AppError(
      "End date must be after the start date",
      400,
      "INVALID_DATES",
    );
  }
  if (joinDeadline && joinDeadline > endDate) {
    throw new AppError(
      "Join deadline cannot be after the end date",
      400,
      "INVALID_DATES",
    );
  }
};

const formatContestDate = (date: Date) =>
  date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

export const createContest = async (
  requestor: AuthenticatedUser,
  bodyData: unknown,
  file?: Express.Multer.File,
) => {
  if (requestor.role !== ROLES.HEAD) {
    throw new AppError(
      "Only Head role can launch contests",
      403,
      "ACCESS_DENIED",
    );
  }

  const parseResult = createContestSchema.safeParse(
    typeof bodyData === "string" ? JSON.parse(bodyData) : bodyData,
  );

  if (!parseResult.success) {
    const errs = parseResult.error.issues.map((i) => i.message).join(", ");
    throw new AppError(`Validation error: ${errs}`, 400, "INVALID_INPUT");
  }

  const { title, description, branches } = parseResult.data;
  const startDate = new Date(parseResult.data.startDate);
  const endDate = new Date(parseResult.data.endDate);
  const joinDeadline = parseResult.data.joinDeadline
    ? new Date(parseResult.data.joinDeadline)
    : undefined;
  assertValidContestDates(startDate, endDate, joinDeadline);

  // Validate branches exist
  const validBranchIds = branches.map((id) => new Types.ObjectId(id));
  const foundBranches = await Branch.find({
    _id: { $in: validBranchIds },
    isActive: true,
  }).select("_id name");
  if (foundBranches.length !== branches.length) {
    throw new AppError(
      "One or more selected branches do not exist",
      404,
      "BRANCH_NOT_FOUND",
    );
  }

  // Upload Media if attached
  let media;
  if (file) {
    const uploaded = await uploadToCloudinary(
      file.buffer,
      "contests",
      file.mimetype,
    );
    media = {
      ...uploaded,
      originalName: file.originalname,
    };
  }

  const contest = await Contest.create({
    title,
    description,
    branches: validBranchIds,
    media,
    startDate,
    endDate,
    joinDeadline,
    createdBy: new Types.ObjectId(requestor.id),
  });

  // Employees are the ones who opt in, so only they get the call to action.
  const joinBy = formatContestDate(resolveJoinDeadline(contest));
  for (const branchId of branches) {
    await notify({
      roles: [ROLES.EMPLOYEE],
      branchId,
      senderId: requestor.id,
      type: NOTIFICATION_TYPES.SYSTEM_ALERT,
      title: "🏆 New Contest Launched!",
      message: `"${title}" is open in your branch. Tap "I'm in" to join before ${joinBy}.`,
      entityId: contest._id,
      entityType: "Contest",
    });
    await notify({
      roles: [ROLES.MANAGER, ROLES.ADMIN],
      branchId,
      senderId: requestor.id,
      type: NOTIFICATION_TYPES.SYSTEM_ALERT,
      title: "🏆 New Contest Launched!",
      message: `"${title}" has been launched in your branch. Employees can join until ${joinBy}.`,
      entityId: contest._id,
      entityType: "Contest",
    });
  }

  return contest;
};

export const getActiveContestsForUser = async (
  requestor: AuthenticatedUser,
) => {
  if (requestor.branches.length === 0) {
    return [];
  }

  const now = new Date();

  // Upcoming as well as running contests, so employees can join before the
  // start date.
  const contests = await Contest.find({
    branches: {
      $in: requestor.branches.map((id) => new Types.ObjectId(id)),
    },
    isActive: true,
    endDate: { $gte: now },
  })
    .sort({ createdAt: -1 })
    .lean();

  const joined = await ContestParticipant.find({
    user: new Types.ObjectId(requestor.id),
    contest: { $in: contests.map((c) => c._id) },
    status: "joined",
  })
    .select("contest")
    .lean();
  const joinedIds = new Set(joined.map((p) => p.contest.toString()));

  return contests.map((contest) => ({
    ...contest,
    hasJoined: joinedIds.has(String(contest._id)),
  }));
};

export const getContestById = async (
  contestId: string,
  requestor: AuthenticatedUser,
) => {
  if (!Types.ObjectId.isValid(contestId)) {
    throw new AppError("Invalid contest ID", 400, "INVALID_ID");
  }

  const contest = await Contest.findById(contestId)
    .populate("branches", "name branchCode")
    .populate("createdBy", "name email role");

  if (!contest) {
    throw new AppError("Contest not found", 404, "CONTEST_NOT_FOUND");
  }

  // Head/Admin can view any contest; everyone else only contests targeted
  // at one of their own branches.
  if (requestor.role !== ROLES.HEAD && requestor.role !== ROLES.ADMIN) {
    const contestBranchIds = contest.branches.map((branch) =>
      (branch as unknown as { _id: Types.ObjectId })._id.toString(),
    );
    const requestorBranchIds = requestor.branches.map((id) => id.toString());
    const hasAccess = contestBranchIds.some((id) =>
      requestorBranchIds.includes(id),
    );

    if (!hasAccess) {
      throw new AppError(
        "You do not have access to this contest",
        403,
        "ACCESS_DENIED",
      );
    }
  }

  return contest;
};

// Contest details plus whether the requestor has joined, for the "I'm in"
// button.
export const getContestDetailsForUser = async (
  contestId: string,
  requestor: AuthenticatedUser,
) => {
  const contest = await getContestById(contestId, requestor);

  const hasJoined = Boolean(
    await ContestParticipant.exists({
      contest: contest._id,
      user: new Types.ObjectId(requestor.id),
      status: "joined",
    }),
  );

  return { ...contest.toObject(), hasJoined };
};

export const updateContestSchema = createContestSchema.partial();

export const updateContest = async (
  contestId: string,
  requestor: AuthenticatedUser,
  bodyData: unknown,
  file?: Express.Multer.File,
) => {
  if (requestor.role !== ROLES.HEAD) {
    throw new AppError(
      "Only Head role can update contests",
      403,
      "ACCESS_DENIED",
    );
  }

  if (!Types.ObjectId.isValid(contestId)) {
    throw new AppError("Invalid contest ID", 400, "INVALID_ID");
  }

  const contest = await Contest.findById(contestId);
  if (!contest) {
    throw new AppError("Contest not found", 404, "CONTEST_NOT_FOUND");
  }

  const parseResult = updateContestSchema.safeParse(
    typeof bodyData === "string" ? JSON.parse(bodyData) : bodyData,
  );

  if (!parseResult.success) {
    const errs = parseResult.error.issues.map((i) => i.message).join(", ");
    throw new AppError(`Validation error: ${errs}`, 400, "INVALID_INPUT");
  }

  const { title, description, branches, startDate, endDate, joinDeadline } =
    parseResult.data;

  // Validate the resulting dates before touching Cloudinary or the document.
  const nextStartDate = startDate ? new Date(startDate) : contest.startDate;
  const nextEndDate = endDate ? new Date(endDate) : contest.endDate;
  // undefined = unchanged, "" / null = clear
  const nextJoinDeadline =
    joinDeadline === undefined
      ? contest.joinDeadline
      : joinDeadline
        ? new Date(joinDeadline)
        : undefined;
  assertValidContestDates(nextStartDate, nextEndDate, nextJoinDeadline);

  // Validate branches if updated
  if (branches && branches.length > 0) {
    const validBranchIds = branches.map((id) => new Types.ObjectId(id));
    const foundBranches = await Branch.find({
      _id: { $in: validBranchIds },
      isActive: true,
    }).select("_id");

    if (foundBranches.length !== branches.length) {
      throw new AppError(
        "One or more selected branches do not exist",
        404,
        "BRANCH_NOT_FOUND",
      );
    }

    // Dropping a branch would leave its joined employees on the leaderboard
    // of a contest they're no longer targeted by.
    const removedBranchIds = contest.branches.filter(
      (id) => !branches.includes(id.toString()),
    );
    if (removedBranchIds.length > 0) {
      const hasParticipants = await ContestParticipant.exists({
        contest: contest._id,
        status: "joined",
        branch: { $in: removedBranchIds },
      });
      if (hasParticipants) {
        throw new AppError(
          "Employees from a branch you are removing have already joined this contest",
          409,
          "CONTEST_BRANCH_HAS_PARTICIPANTS",
        );
      }
    }

    contest.branches = validBranchIds;
  }

  // Handle new media upload & old media cleanup
  if (file) {
    if (contest.media?.publicId) {
      // Delete previous file from Cloudinary
      await cloudinary.uploader.destroy(contest.media.publicId, {
        resource_type: contest.media.resourceType,
      });
    }

    const uploaded = await uploadToCloudinary(
      file.buffer,
      "contests",
      file.mimetype,
    );
    contest.media = {
      ...uploaded,
      originalName: file.originalname,
    };
  }

  if (title) contest.title = title;
  if (description) contest.description = description;
  contest.startDate = nextStartDate;
  contest.endDate = nextEndDate;
  contest.joinDeadline = nextJoinDeadline;

  await contest.save();
  return contest;
};

export const toggleContestStatus = async (
  contestId: string,
  requestor: AuthenticatedUser,
  isActive: boolean,
) => {
  if (requestor.role !== ROLES.HEAD) {
    throw new AppError(
      "Only Head role can toggle contest status",
      403,
      "ACCESS_DENIED",
    );
  }

  if (!Types.ObjectId.isValid(contestId)) {
    throw new AppError("Invalid contest ID", 400, "INVALID_ID");
  }

  const contest = await Contest.findByIdAndUpdate(
    contestId,
    { isActive },
    { new: true },
  );

  if (!contest) {
    throw new AppError("Contest not found", 404, "CONTEST_NOT_FOUND");
  }

  return contest;
};

export interface GetAllContestsOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  branchId?: string;
}

export const getAllContestsForAdmin = async (
  requestor: AuthenticatedUser,
  options: GetAllContestsOptions = {},
) => {
  if (requestor.role !== ROLES.HEAD && requestor.role !== ROLES.ADMIN) {
    throw new AppError(
      "Only Head or Admin roles can view all contests",
      403,
      "ACCESS_DENIED",
    );
  }

  const { page = 1, limit = 10, search, isActive, branchId } = options;
  const skip = (page - 1) * limit;

  // Dynamic filter query
  const query: Record<string, any> = {};

  if (typeof isActive === "boolean") {
    query.isActive = isActive;
  }

  if (branchId) {
    if (!Types.ObjectId.isValid(branchId)) {
      throw new AppError("Invalid branch ID filter", 400, "INVALID_ID");
    }
    query.branches = new Types.ObjectId(branchId);
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const [contests, total] = await Promise.all([
    Contest.find(query)
      .populate("branches", "name branchCode")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Contest.countDocuments(query),
  ]);

  return {
    contests,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// =========================================================
// PARTICIPATION ("I'm in")
// =========================================================
//
// Employees opt in with "I'm in". There is no scoring: the leaderboard ranks
// joined participants by revenue booked between the contest's startDate and
// endDate — the same window for everyone, no matter when they joined.

// Joining stays open until joinDeadline, or until the contest ends if none was
// set. This only gates entry; results always cover startDate -> endDate.
const resolveJoinDeadline = (contest: IContest) =>
  contest.joinDeadline ?? contest.endDate;

const isDuplicateKeyError = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  (err as { code?: number }).code === 11000;

export const joinContest = async (
  contestId: string,
  requestor: AuthenticatedUser,
) => {
  if (!Types.ObjectId.isValid(contestId)) {
    throw new AppError("Invalid contest ID", 400, "INVALID_ID");
  }

  const contest = await Contest.findById(contestId);
  if (!contest) {
    throw new AppError("Contest not found", 404, "CONTEST_NOT_FOUND");
  }

  if (!contest.isActive) {
    throw new AppError("Contest is inactive", 400, "CONTEST_INACTIVE");
  }

  const now = new Date();
  if (now > resolveJoinDeadline(contest)) {
    throw new AppError(
      "Joining for this contest has closed",
      400,
      "CONTEST_JOIN_CLOSED",
    );
  }

  // ObjectId[] .includes() compares references, so match on string ids.
  // The participant is recorded under the first of the user's branches that
  // the contest targets.
  const contestBranchIds = contest.branches.map((id) => id.toString());
  const branchId = requestor.branches
    .map((id) => id.toString())
    .find((id) => contestBranchIds.includes(id));
  if (!branchId) {
    throw new AppError(
      "This contest is not open to your branch",
      403,
      "ACCESS_DENIED",
    );
  }

  const contestObjectId = contest._id as Types.ObjectId;
  const userObjectId = new Types.ObjectId(requestor.id);

  // Matches only when the user isn't already in (and wasn't removed), so a
  // successful write always means a real "not joined -> joined" change. If a
  // joined/removed record exists, the upsert's insert hits the unique
  // { contest, user } index instead; the same happens when two requests race.
  try {
    const participant = await ContestParticipant.findOneAndUpdate(
      {
        contest: contestObjectId,
        user: userObjectId,
        status: { $nin: ["joined", "removed"] },
      },
      {
        $set: {
          status: "joined",
          joinedAt: now,
          branch: new Types.ObjectId(branchId),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await Contest.updateOne(
      { _id: contestObjectId },
      { $inc: { participantCount: 1 } },
    );

    return participant;
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;

    const existing = await ContestParticipant.findOne({
      contest: contestObjectId,
      user: userObjectId,
    });

    if (existing?.status === "removed") {
      throw new AppError(
        "You have been removed from this contest",
        403,
        "CONTEST_PARTICIPANT_REMOVED",
      );
    }

    // Already joined: repeat taps are harmless and don't recount.
    if (existing) return existing;
    throw err;
  }
};

export const withdrawFromContest = async (
  contestId: string,
  requestor: AuthenticatedUser,
) => {
  if (!Types.ObjectId.isValid(contestId)) {
    throw new AppError("Invalid contest ID", 400, "INVALID_ID");
  }

  const contest = await Contest.findById(contestId);
  if (!contest) {
    throw new AppError("Contest not found", 404, "CONTEST_NOT_FOUND");
  }

  if (new Date() > resolveJoinDeadline(contest)) {
    throw new AppError(
      "Withdrawals for this contest have closed",
      400,
      "CONTEST_WITHDRAW_CLOSED",
    );
  }

  // Conditional on "joined" so only a real transition decrements the count.
  const participant = await ContestParticipant.findOneAndUpdate(
    {
      contest: contest._id,
      user: new Types.ObjectId(requestor.id),
      status: "joined",
    },
    { $set: { status: "withdrawn" } },
  );
  if (!participant) {
    throw new AppError(
      "You are not participating in this contest",
      404,
      "NOT_PARTICIPATING",
    );
  }

  await Contest.updateOne(
    { _id: contest._id },
    { $inc: { participantCount: -1 } },
  );
};

// Head/Admin kicks someone out. "removed" (unlike "withdrawn") blocks
// rejoining — see joinContest.
export const removeContestParticipant = async (
  contestId: string,
  userId: string,
) => {
  if (!Types.ObjectId.isValid(contestId) || !Types.ObjectId.isValid(userId)) {
    throw new AppError("Invalid contest or user ID", 400, "INVALID_ID");
  }

  const participant = await ContestParticipant.findOneAndUpdate(
    {
      contest: new Types.ObjectId(contestId),
      user: new Types.ObjectId(userId),
      status: "joined",
    },
    { $set: { status: "removed" } },
  );
  if (!participant) {
    throw new AppError(
      "This user is not participating in the contest",
      404,
      "NOT_PARTICIPATING",
    );
  }

  await Contest.updateOne(
    { _id: participant.contest },
    { $inc: { participantCount: -1 } },
  );
};

export const getContestParticipants = async (
  contestId: string,
  requestor: AuthenticatedUser,
) => {
  // Validates the id and enforces branch access.
  const contest = await getContestById(contestId, requestor);

  return ContestParticipant.find({ contest: contest._id, status: "joined" })
    .populate("user", "name email")
    .populate("branch", "name branchCode")
    .sort({ joinedAt: 1 })
    .lean();
};

export interface ContestLeaderboardRow {
  rank: number;
  employeeId: string;
  name: string;
  branchName: string;
  verified: number;
  pending: number;
  entries: number;
}

// Ranks joined participants by verified revenue over the whole contest window
// (pending only breaks ties). Computed from Revenue on every call.
export const getContestLeaderboard = async (
  contestId: string,
  requestor: AuthenticatedUser,
): Promise<ContestLeaderboardRow[]> => {
  const contest = await getContestById(contestId, requestor);
  if (new Date() < contest.startDate) return [];

  const participants = await ContestParticipant.find({
    contest: contest._id,
    status: "joined",
  })
    .populate<{ user: { _id: Types.ObjectId; name: string } }>("user", "name")
    .populate<{ branch: { _id: Types.ObjectId; name: string } }>(
      "branch",
      "name",
    )
    .lean();
  if (participants.length === 0) return [];

  const totals = await Revenue.aggregate<{
    _id: Types.ObjectId;
    verified: number;
    pending: number;
    entries: number;
  }>([
    {
      $match: {
        employee: { $in: participants.map((p) => p.user._id) },
        date: { $gte: contest.startDate, $lte: contest.endDate },
        status: { $ne: REVENUE_STATUS.REJECTED },
      },
    },
    {
      $group: {
        _id: "$employee",
        verified: {
          $sum: {
            $cond: [
              { $eq: ["$status", REVENUE_STATUS.VERIFIED] },
              "$amount",
              0,
            ],
          },
        },
        pending: {
          $sum: {
            $cond: [
              { $eq: ["$status", REVENUE_STATUS.VERIFIED] },
              0,
              "$amount",
            ],
          },
        },
        entries: { $sum: 1 },
      },
    },
  ]);
  const totalsByEmployee = new Map(totals.map((t) => [t._id.toString(), t]));

  return participants
    .map((p) => {
      const employeeId = p.user._id.toString();
      const total = totalsByEmployee.get(employeeId);
      return {
        employeeId,
        name: p.user.name,
        branchName: p.branch?.name ?? "",
        verified: total?.verified ?? 0,
        pending: total?.pending ?? 0,
        entries: total?.entries ?? 0,
      };
    })
    .sort((a, b) => b.verified - a.verified || b.pending - a.pending)
    .map((row, index) => ({ rank: index + 1, ...row }));
};
