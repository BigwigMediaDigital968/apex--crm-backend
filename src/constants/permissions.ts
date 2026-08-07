export const PERMISSIONS = {
  // Users
  USER_VIEW: "user:view",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_ASSIGN_ROLE: "user:assign-role",
  USER_ASSIGN_BRANCH: "user:assign-branch",
  USER_STATUS_UPDATE: "user:status:update",

  // Branches
  BRANCH_VIEW: "branch:view",
  BRANCH_CREATE: "branch:create",
  BRANCH_UPDATE: "branch:update",
  BRANCH_DELETE: "branch:delete",

  LEAD_SOURCE_CREATE: "lead-source:create",
  LEAD_SOURCE_UPDATE: "lead-source:update",
  LEAD_SOURCE_READ: "lead-source:read",
  LEAD_SOURCE_DELETE: "lead-source:delete",

  // Leads
  LEAD_VIEW: "lead:view",
  LEAD_CREATE: "lead:create",
  LEAD_UPDATE: "lead:update",
  LEAD_DELETE: "lead:delete",
  LEAD_ASSIGN: "lead:assign",

  // Customers
  CUSTOMER_VIEW: "customer:view",
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_UPDATE: "customer:update",
  CUSTOMER_DELETE: "customer:delete",

  // Tasks
  TASK_VIEW: "task:view",
  TASK_CREATE: "task:create",
  TASK_UPDATE: "task:update",
  TASK_DELETE: "task:delete",
  TASK_ASSIGN: "task:assign",

  // Activities
  ACTIVITY_VIEW: "activity:view",
  ACTIVITY_CREATE: "activity:create",
  ACTIVITY_UPDATE: "activity:update",
  ACTIVITY_DELETE: "activity:delete",

  // Reports
  REPORT_VIEW: "report:view",
  REPORT_EXPORT: "report:export",

  // Audit
  AUDIT_VIEW: "audit:view",
  AUDIT_READ: "audit:read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
