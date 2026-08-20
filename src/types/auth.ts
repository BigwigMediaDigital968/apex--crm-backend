import type { Role } from "../constants/roles.js";

export interface AuthenticatedUser {
  branchId: string[];
  id: string;
  email: string;
  name: string;
  role: Role;
  branches: string[];
}