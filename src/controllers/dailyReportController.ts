import { Request, Response } from "express";
import { User } from "../models/User.js";
import { DailyReport } from "../models/DailyReports.js";

// Helper to calculate submission window (30 mins before end of work day)
const checkSubmissionWindowAvailability = (
  workingHoursEndTimeStr: string = "18:00",
) => {
  const now = new Date();
  const parts = workingHoursEndTimeStr.split(":");
  const endHour = Number(parts[0]) || 18;
  const endMinute = Number(parts[1]) || 0;

  const windowStartTime = new Date(now);
  windowStartTime.setHours(endHour, endMinute - 30, 0, 0);

  const windowEndTime = new Date(now);
  windowEndTime.setHours(endHour + 2, 0, 0, 0); // Grace window after shift

  const isWindowOpen = now >= windowStartTime && now <= windowEndTime;

  return {
    isWindowOpen,
    windowStartTime,
    windowEndTime,
    currentTime: now,
  };
};

/**
 * Check if submission portal window is active
 */
export const checkReportWindow = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const user = await User.findById(userId);

    // Default work end time to 18:00 if not specified on user/shift model
    const workEndTime = (user as any)?.workEndTime || "18:00";
    const windowStatus = checkSubmissionWindowAvailability(workEndTime);

    // Check if report already submitted today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingReport = await DailyReport.findOne({
      employeeId: userId,
      reportDate: today,
    });

    return res.status(200).json({
      success: true,
      data: {
        ...windowStatus,
        alreadySubmitted: !!existingReport,
        submittedReport: existingReport || null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Submit Daily Report
 */
export const submitDailyReport = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      callsAttended,
      callsAnswered,
      conversions,
      totalCallDurationSeconds,
      workCompleted,
      dailyFeedback,
      additionalData,
    } = req.body;

    // Validate 30-minute submission window
    const workEndTime = (user as any)?.workEndTime || "18:00";
    const windowStatus = checkSubmissionWindowAvailability(workEndTime);

    if (!windowStatus.isWindowOpen) {
      return res.status(400).json({
        message:
          "Report submission window is inactive. Reports can only be submitted 30 minutes prior to shift completion.",
      });
    }

    // Normalize today's date for indexing
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingReport = await DailyReport.findOne({
      employeeId: userId,
      reportDate: today,
    });

    if (existingReport) {
      return res.status(400).json({
        message: "You have already submitted a daily report for today.",
      });
    }

    const report = await DailyReport.create({
      employeeId: userId,
      branchId: (user as any)?.branchId,
      reportDate: today,
      callsAttended: callsAttended || 0,
      callsAnswered: callsAnswered || 0,
      conversions: conversions || 0,
      totalCallDurationSeconds: totalCallDurationSeconds || 0,
      workCompleted,
      dailyFeedback,
      additionalData: additionalData || {},
      status: "SUBMITTED",
    });

    return res.status(201).json({
      success: true,
      message: "Daily report submitted successfully",
      data: report,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "Report for today has already been submitted." });
    }
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Get logged-in employee's daily report history
 */
export const getMyDailyReports = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const reports = await DailyReport.find({ employeeId: userId })
      .sort({ reportDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DailyReport.countDocuments({ employeeId: userId });

    return res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Management: Get all employee daily reports with filters
 */
export const getAllDailyReports = async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      branchId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const filter: any = {};

    if (employeeId) filter.employeeId = employeeId;
    if (branchId) filter.branchId = branchId;

    if (startDate || endDate) {
      filter.reportDate = {};
      if (startDate) filter.reportDate.$gte = new Date(startDate as string);
      if (endDate) filter.reportDate.$lte = new Date(endDate as string);
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const reports = await DailyReport.find(filter)
      .populate("employeeId", "name email role designation")
      .populate("branchId", "name")
      .sort({ reportDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await DailyReport.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Management: Get single report detail
 */
export const getDailyReportById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const report = await DailyReport.findById(id)
      .populate("employeeId", "name email role designation")
      .populate("branchId", "name");

    if (!report) {
      return res.status(404).json({ message: "Daily report not found" });
    }

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
