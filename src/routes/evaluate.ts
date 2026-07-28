import { Router } from "express";
import * as flagService from "../services/flagService.js";

export const evaluateRouter = Router();

evaluateRouter.get("/", async (req, res) => {
  const { flag, user } = req.query;

  if (typeof flag !== "string" || flag.trim() === "") {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Flag key is required." },
    });
  }

  if (typeof user !== "string" || user.trim() === "") {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "User is required." },
    });
  }

  const result = await flagService.evaluate(flag, user);
  return res.json(result);
});
