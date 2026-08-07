import type { Response } from "express";

export const successResponse = (
  res: Response,
  {
    statusCode = 200,
    message,
    data,
  }: {
    statusCode?: number;
    message?: string;
    data?: unknown;
  },
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};