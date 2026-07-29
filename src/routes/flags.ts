import { Router } from "express";
import * as flagService from "../services/flagService.js";
import { requireActor } from "../midlleware/requireActor.js";

export const flagsRouter = Router();

flagsRouter.post("/", requireActor, async (req, res) => {
  if (!req.actor) {
    return res.status(401).json({
      error: "Actor is required",
    });
  }
  const flag = await flagService.createFlag({
    key: req.body.key,
    description: req.body.description,
    actor: req.actor,
  });
  return res.status(201).json(flag);
});

flagsRouter.get("/", async (_req, res) => {
  const allFlags = await flagService.flagsList();
  res.json(allFlags);
});

flagsRouter.get("/:key", async (req, res) => {
  const { key } = req.params;

  const flag = await flagService.getFlagByKey(key);
  return res.json(flag);
});

flagsRouter.patch("/:key", requireActor, async (req, res) => {
  let { key } = req.params;
  if (Array.isArray(key)) {
    key = key[0];
  }
  if (!key) {
    return res.status(401).json({ error: "Key is not provided" });
  }
  if (!req.actor) {
    return res.status(401).json({
      error: "Actor is required",
    });
  }
  const updatedFlag = await flagService.setEnabled(
    key,
    req.actor,
    req.body.enabled,
  );
  return res.json(updatedFlag);
});

flagsRouter.post("/:key/targets", requireActor, async (req, res) => {
  const { key } = req.params;
  const keyParams = Array.isArray(key) ? key[0] : key;
  if (!keyParams) {
    return res.status(400).json({
      error: {
        message: "Missing key",
      },
    });
  }
  const { userId } = req.body;
  const flag = await flagService.addTarget(keyParams, userId, req.actor!);
  return res.status(200).json(flag);
});

flagsRouter.delete("/:key/targets/:userId", requireActor, async (req, res) => {
  const { key } = req.params;
  const keyParams = Array.isArray(key) ? key[0] : key;
  if (!keyParams) {
    return res.status(400).json({
      error: {
        message: "Missing key",
      },
    });
  }
  const { userId } = req.params;
  if (typeof userId !== "string" || userId.length === 0) {
    return {
      error: { message: "Invalid userId" },
    };
  }

  const flag = await flagService.removeTarget(keyParams, userId, req.actor!);

  return res.status(200).json(flag);
});

flagsRouter.patch("/:key/rollout", requireActor, async (req, res) => {
  const { key } = req.params;
  const keyParams = Array.isArray(key) ? key[0] : key;
  if (!keyParams) {
    return res.status(400).json({
      error: {
        message: "Missing key",
      },
    });
  }
  const { percentage } = req.body;
  if (
    typeof percentage !== "number" ||
    !Number.isInteger(percentage) ||
    percentage < 0 ||
    percentage > 100
  ) {
    return res.status(400).json({
      error: {
        message: "percentage must be an integer between 0 and 100",
      },
    });
  }

  const flag = await flagService.setRollout(keyParams, percentage, req.actor!);
  return res.json(flag);
});
