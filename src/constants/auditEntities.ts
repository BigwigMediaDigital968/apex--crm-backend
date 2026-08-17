export const AUDIT_ENTITIES = {
  USER: "User",
  EMPLOYEE_PROFILE: "EmployeeProfile",
  BRANCH: "Branch",
  HOLIDAY: "Holiday",
  SESSION: "Session",
  AUTH: "Auth",
  LEAD: "Lead",
  CONTACT: "Contact",
  DEAL: "Deal",
  TASK: "Task",
} as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
