import mongoose, { PipelineStage } from "mongoose";
import { Lead } from "../models/Lead.js";
import { Attendance } from "../models/Attendance.js";
import { CallLog } from "../models/CallLog.js";
import { Revenue } from "../models/Revenue.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { ROLES } from "../constants/roles.js";
import { Parser } from "json2csv";
import Workbook from "exceljs";

export interface ReportFilterQuery {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  employeeId?: string;
  module?: "LEAD" | "ATTENDANCE" | "CALL_LOG" | "REVENUE" | "LEAVE" | "ALL";
  format?: "json" | "csv" | "excel";
}

export interface UserScope {
  id: string;
  role: string;
  branches: string[];
}

export class ReportService {
  /**
   * Generates scoped Match Query based on Role and Filter params
   */
  private static buildScopeFilter(
    user: UserScope,
    queryBranch?: string,
    queryEmployee?: string,
  ) {
    const match: Record<string, any> = {};

    // 1. Role-based Branch Scope
    if (user.role !== ROLES.HEAD) {
      if (queryBranch && user.branches.includes(queryBranch)) {
        match.branch = new mongoose.Types.ObjectId(queryBranch);
      } else if (user.branches.length > 0) {
        match.branch = {
          $in: user.branches.map((b) => new mongoose.Types.ObjectId(b)),
        };
      }
    } else if (queryBranch) {
      match.branch = new mongoose.Types.ObjectId(queryBranch);
    }

    // 2. Employee Scope
    if (queryEmployee) {
      match.employeeId = new mongoose.Types.ObjectId(queryEmployee);
    }

    return match;
  }

  /**
   * Aggregates Lead Statistics
   */
  public static async getLeadReport(
    user: UserScope,
    filters: ReportFilterQuery,
  ) {
    const scope = this.buildScopeFilter(
      user,
      filters.branchId,
      filters.employeeId,
    );

    const dateMatch: Record<string, any> = { isDeleted: false, ...scope };
    if (scope.employeeId) {
      dateMatch.assignedTo = scope.employeeId;
      delete dateMatch.employeeId;
    }
    if (filters.startDate || filters.endDate) {
      dateMatch.createdAt = {};
      if (filters.startDate)
        dateMatch.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) dateMatch.createdAt.$lte = new Date(filters.endDate);
    }

    const pipeline: PipelineStage[] = [
      { $match: dateMatch },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: "$count" },
          statusBreakdown: { $push: { status: "$_id", count: "$count" } },
        },
      },
      { $project: { _id: 0 } },
    ];

    const result = await Lead.aggregate(pipeline);
    return result[0] || { totalLeads: 0, statusBreakdown: [] };
  }

  /**
   * Aggregates Attendance Metrics
   */
  public static async getAttendanceReport(
    user: UserScope,
    filters: ReportFilterQuery,
  ) {
    const scope = this.buildScopeFilter(
      user,
      filters.branchId,
      filters.employeeId,
    );
    if (scope.employeeId) {
      scope.employee = scope.employeeId;
      delete scope.employeeId;
    }

    if (filters.startDate || filters.endDate) {
      scope.createdAt = {};
      if (filters.startDate) scope.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) scope.createdAt.$lte = new Date(filters.endDate);
    }

    const result = await Attendance.aggregate([
      { $match: scope },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalLateMinutes: { $sum: "$lateMinutes" },
          totalWorkingMinutes: { $sum: "$totalWorkingMinutes" },
        },
      },
    ]);

    return result;
  }

  /**
   * Aggregates Dialer / Call Log Metrics
   */
  public static async getCallReport(
    user: UserScope,
    filters: ReportFilterQuery,
  ) {
    const scope = this.buildScopeFilter(
      user,
      filters.branchId,
      filters.employeeId,
    );
    if (scope.employeeId) {
      scope.caller = scope.employeeId;
      delete scope.employeeId;
    }

    if (filters.startDate || filters.endDate) {
      scope.createdAt = {};
      if (filters.startDate) scope.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) scope.createdAt.$lte = new Date(filters.endDate);
    }

    return CallLog.aggregate([
      { $match: scope },
      {
        $group: {
          _id: "$callStatus",
          totalCalls: { $sum: 1 },
          totalDurationSeconds: { $sum: "$duration" },
          avgDurationSeconds: { $avg: "$duration" },
        },
      },
    ]);
  }

  /**
   * Aggregates Revenue Figures
   */
  public static async getRevenueReport(
    user: UserScope,
    filters: ReportFilterQuery,
  ) {
    const scope = this.buildScopeFilter(
      user,
      filters.branchId,
      filters.employeeId,
    );
    if (scope.employeeId) {
      scope.employee = scope.employeeId;
      delete scope.employeeId;
    }

    if (filters.startDate || filters.endDate) {
      scope.date = {};
      if (filters.startDate) scope.date.$gte = new Date(filters.startDate);
      if (filters.endDate) scope.date.$lte = new Date(filters.endDate);
    }

    return Revenue.aggregate([
      { $match: scope },
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  /**
   * Aggregates Leave Metrics
   */
  public static async getLeaveReport(
    user: UserScope,
    filters: ReportFilterQuery,
  ) {
    const scope = this.buildScopeFilter(
      user,
      filters.branchId,
      filters.employeeId,
    );
    if (scope.employeeId) {
      scope.employee = scope.employeeId;
      delete scope.employeeId;
    }

    if (filters.startDate || filters.endDate) {
      scope.startDate = {};
      if (filters.startDate) scope.startDate.$gte = new Date(filters.startDate);
      if (filters.endDate) scope.startDate.$lte = new Date(filters.endDate);
    }

    return LeaveRequest.aggregate([
      { $match: scope },
      {
        $group: {
          _id: { status: "$status", leaveType: "$leaveType" },
          totalDays: { $sum: "$totalDays" },
          requestsCount: { $sum: 1 },
        },
      },
    ]);
  }

  /**
   * Dashboard Summary API Pipeline
   */
  public static async getDashboardSummary(
    user: UserScope,
    filters: ReportFilterQuery,
  ) {
    const [leads, attendance, calls, revenue, leaves] = await Promise.all([
      this.getLeadReport(user, filters),
      this.getAttendanceReport(user, filters),
      this.getCallReport(user, filters),
      this.getRevenueReport(user, filters),
      this.getLeaveReport(user, filters),
    ]);

    return {
      leads,
      attendance,
      calls,
      revenue,
      leaves,
    };
  }

  /**
   * CSV Data Exporter
   */
  public static exportToCSV(data: any[]): string {
    const json2csvParser = new Parser();
    return json2csvParser.parse(data);
  }

  /**
   * Excel Buffer Exporter
   */
  public static async exportToExcel(
    sheetName: string,
    data: any[],
  ): Promise<Buffer> {
    const workbook = new Workbook.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (data.length > 0) {
      const headers = Object.keys(data[0]).map((key) => ({
        header: key.toUpperCase(),
        key: key,
        width: 20,
      }));
      worksheet.columns = headers;
      worksheet.addRows(data);
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}
