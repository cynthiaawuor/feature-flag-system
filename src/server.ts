import "dotenv/config";
import express from "express";
import { flagsRouter } from "./routes/flags.js";
import { errorHandler } from "./midlleware/errorHandler.js";

const port = process.env.PORT ?? 4000;

const app = express();
app.use(express.json());

app.use("/flags", flagsRouter);

app.use(errorHandler);

app.listen(4000, () => {
  console.log(`Server listening on port ${port}`);
});
