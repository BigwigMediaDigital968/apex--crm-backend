export const AUDIT_ENTITIES = {
  USER: "User",
  BRANCH: "Branch",
  SESSION: "Session",
  AUTH: "Auth",
  LEAD: "Lead",
  CONTACT: "Contact",
  DEAL: "Deal",
  TASK: "Task",
} as const;

export type AuditEntity =
  typeof AUDIT_ENTITIES[
    keyof typeof AUDIT_ENTITIES
  ];