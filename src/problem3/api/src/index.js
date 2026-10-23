const express = require("express");
const { Pool } = require("pg");
const Redis = require("ioredis");

const app = express();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: "postgres",
  password: "postgres",
  database: "postgres",
  port: 5432,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
});

// Unhandled, an idle client's error kills the process.
pool.on("error", (err) => console.error("pg pool error:", err.message));

const redis = new Redis({ host: process.env.REDIS_HOST, port: 6379, enableOfflineQueue: false });
redis.on("error", (err) => console.error("redis error:", err.message));

app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    // Best-effort cache write: a Redis outage must not delay or fail the response.
    redis.set("last_call", Date.now()).catch((err) => console.error("redis set failed:", err.message));
    res.json({ ok: true, time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/status", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(3000, () => console.log("API running on 3000"));
