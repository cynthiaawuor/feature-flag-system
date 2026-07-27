import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const main = async () => {
  const result = await pool.query("SELECT 1 + 1 AS answer");

  console.log("Postgres says:", result.rows[0]);

  await pool.end();
};

main().catch((err) => {
  console.error("Connection failed:", err);
  process.exit(1);
});
