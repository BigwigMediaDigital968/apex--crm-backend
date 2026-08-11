import { z } from "zod";

export const assignLeadSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required"),
});

export type AssignLeadInput = z.infer<typeof assignLeadSchema>;
