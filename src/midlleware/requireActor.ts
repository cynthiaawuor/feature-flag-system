import type { NextFunction, Request, Response } from "express";

/*******************************************************
 TypeScript doesn't know Express's Request has an `actor` field by default —
 this tells it that it does, so `req.actor` type-checks everywhere.
 * 
 *******************************************************/
declare global {
  namespace Express {
    interface Request {
      actor?: string;
    }
  }
}

export const requireActor = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const actor = req.header("X-Actor-Id");

  if (!actor || actor.trim() === "") {
    return res.status(400).json({
      error: {
        code: "MISSING_ACTOR",
        message:
          'This request changes state and must say who is making it. Send an "X-Actor-Id" header',
      },
    });
  }

  req.actor = actor.trim();
  next();
};
