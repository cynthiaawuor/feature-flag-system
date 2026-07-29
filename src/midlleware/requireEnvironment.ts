import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      environment?: string;
    }
  }
}

export const requireEnvironment = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const raw = req.body?.environment ?? req.query.environment;

  if (typeof raw !== "string" || raw.trim() === "") {
    return res.status(400).json({
      error: {
        code: "MISSING_ENVIRONMENT",
        message:
          'This request is scoped to an environment. Send it as an "environment" field (body or query param).',
      },
    });
  }

  req.environment = raw.trim();
  next();
};
