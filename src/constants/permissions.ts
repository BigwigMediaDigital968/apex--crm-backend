export const PERMISSIONS = {
  // =========================================================
  // USERS / EMPLOYEE MANAGEMENT
  // =========================================================

  USER_VIEW: "user:view",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",

  USER_ASSIGN_ROLE: "user:assign-role",
  USER_ASSIGN_BRANCH: "user:assign-branch",
  USER_STATUS_UPDATE: "user:status:update",

  // Employee / HR

  EMPLOYEE_VIEW: "employee:view",
  EMPLOYEE_CREATE: "employee:create",
  EMPLOYEE_UPDATE: "employee:update",
  EMPLOYEE_DELETE: "employee:delete",
  EMPLOYEE_DOCUMENT_VIEW: "employee:document:view",
  EMPLOYEE_DOCUMENT_UPDATE: "employee:document:update",
  EMPLOYEE_SALARY_VIEW: "employee:salary:view",
  EMPLOYEE_SALARY_UPDATE: "employee:salary:update",

  // =========================================================
  // BRANCH MANAGEMENT
  // =========================================================

  BRANCH_VIEW: "branch:view",
  BRANCH_CREATE: "branch:create",
  BRANCH_UPDATE: "branch:update",
  BRANCH_DELETE: "branch:delete",

  // Branch Attendance Configuration
  BRANCH_ATTENDANCE_VIEW: "branch-attendance:view",
  BRANCH_ATTENDANCE_UPDATE: "branch-attendance:update",

  // Attendance Configuration

  ATTENDANCE_CONFIG_VIEW: "attendance-config:view",
  ATTENDANCE_CONFIG_UPDATE: "attendance-config:update",

  // Holidays
  HOLIDAY_VIEW: "holiday:view",
  HOLIDAY_CREATE: "holiday:create",
  HOLIDAY_UPDATE: "holiday:update",
  HOLIDAY_DELETE: "holiday:delete",

  // =========================================================
  // LEAD SOURCES
  // =========================================================

  LEAD_SOURCE_READ: "lead-source:read",
  LEAD_SOURCE_CREATE: "lead-source:create",
  LEAD_SOURCE_UPDATE: "lead-source:update",
  LEAD_SOURCE_DELETE: "lead-source:delete",

  // =========================================================
  // LEAD MANAGEMENT
  // =========================================================

  LEAD_VIEW: "lead:view",
  LEAD_CREATE: "lead:create",
  LEAD_UPDATE: "lead:update",
  LEAD_DELETE: "lead:delete",

  LEAD_ASSIGN: "lead:assign",
  LEAD_REASSIGN: "lead:reassign",

  LEAD_IMPORT: "lead:import",
  LEAD_EXPORT: "lead:export",

  LEAD_BULK_UPDATE: "lead:bulk-update",
  LEAD_BULK_ASSIGN: "lead:bulk-assign",

  LEAD_ACTIVITY_VIEW: "lead:activity:view",
  LEAD_ACTIVITY_CREATE: "lead:activity:create",

  LEAD_FOLLOWUP_VIEW: "lead:followup:view",
  LEAD_FOLLOWUP_CREATE: "lead:followup:create",
  LEAD_FOLLOWUP_UPDATE: "lead:followup:update",

  // =========================================================
  // CUSTOMER MANAGEMENT
  // =========================================================

  CUSTOMER_VIEW: "customer:view",
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_UPDATE: "customer:update",
  CUSTOMER_DELETE: "customer:delete",

  // =========================================================
  // TASK MANAGEMENT
  // =========================================================

  TASK_VIEW: "task:view",
  TASK_CREATE: "task:create",
  TASK_UPDATE: "task:update",
  TASK_DELETE: "task:delete",
  TASK_ASSIGN: "task:assign",

  // =========================================================
  // ACTIVITIES
  // =========================================================

  ACTIVITY_VIEW: "activity:view",
  ACTIVITY_CREATE: "activity:create",
  ACTIVITY_UPDATE: "activity:update",
  ACTIVITY_DELETE: "activity:delete",

  // =========================================================
  // ATTENDANCE
  // =========================================================

  ATTENDANCE_VIEW: "attendance:view",
  ATTENDANCE_CREATE: "attendance:create",
  ATTENDANCE_UPDATE: "attendance:update",
  ATTENDANCE_DELETE: "attendance:delete",
  ATTENDANCE_MANAGE: "attendance:manage",

  // =========================================================
  // SALARY / PAYROLL
  // =========================================================

  SALARY_VIEW: "salary:view",
  SALARY_CREATE: "salary:create",
  SALARY_UPDATE: "salary:update",
  SALARY_DELETE: "salary:delete",
  SALARY_MANAGE: "salary:manage",

  // =========================================================
  // ACHIEVEMENTS
  // =========================================================

  ACHIEVEMENT_VIEW: "achievement:view",
  ACHIEVEMENT_CREATE: "achievement:create",
  ACHIEVEMENT_UPDATE: "achievement:update",
  ACHIEVEMENT_DELETE: "achievement:delete",

  // =========================================================
  // PERFORMANCE
  // =========================================================

  PERFORMANCE_VIEW: "performance:view",
  PERFORMANCE_CREATE: "performance:create",
  PERFORMANCE_UPDATE: "performance:update",
  PERFORMANCE_MANAGE: "performance:manage",

  // =========================================================
  // INCENTIVES
  // =========================================================

  INCENTIVE_VIEW: "incentive:view",
  INCENTIVE_CREATE: "incentive:create",
  INCENTIVE_UPDATE: "incentive:update",
  INCENTIVE_DELETE: "incentive:delete",
  INCENTIVE_MANAGE: "incentive:manage",

  // =========================================================
  // REVENUE
  // =========================================================

  REVENUE_VIEW: "revenue:view",
  REVENUE_CREATE: "revenue:create",
  REVENUE_UPDATE: "revenue:update",
  REVENUE_DELETE: "revenue:delete",
  REVENUE_MANAGE: "revenue:manage",

  // =========================================================
  // REPORTS
  // =========================================================

  REPORT_VIEW: "report:view",
  REPORT_EXPORT: "report:export",

  // =========================================================
  // AUDIT
  // =========================================================

  AUDIT_VIEW: "audit:view",
  AUDIT_READ: "audit:read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
