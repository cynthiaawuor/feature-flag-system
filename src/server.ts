import "dotenv/config";
import express from "express";
import cors from "cors";
import { flagsRouter } from "./routes/flags.js";
import { errorHandler } from "./midlleware/errorHandler.js";
import { evaluateRouter } from "./routes/evaluate.js";

const port = process.env.PORT ?? 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.use("/flags", flagsRouter);
app.use("/evaluate", evaluateRouter);

app.use(errorHandler);

app.listen(4000, () => {
  console.log(`Server listening on port ${port}`);
});
