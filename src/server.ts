import "dotenv/config";
import express from "express";

const port = process.env.PORT ?? 4000;
const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(4000, () => {
  console.log(`Server listening on port ${port}`);
});
