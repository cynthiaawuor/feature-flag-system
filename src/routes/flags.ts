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

flagsRouter.get("/", async (req, res) => {
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
