import "dotenv/config";
import { createBot } from "./bot/index.js";
import { startHealthServer } from "./health-server.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error(
    "TELEGRAM_BOT_TOKEN is not set. Copy .env.example → .env and fill it in.",
  );
  process.exit(1);
}

const bot = createBot(TOKEN);
const health = startHealthServer();

bot.catch((err) => {
  console.error("[Bot] Unhandled error: ", err.message);
});

bot.start({
  onStart: (info) => {
    console.log(`Paper trader running as @${info.username}`);
    const pollSec = Math.max(
      1,
      Math.round(parseInt(process.env.POLL_INTERVAL_MS ?? "30000", 10) / 1000),
    );
    console.log(
      `Tracking Solana tokens | TP +60% | SL −40% | Poll ${pollSec}s`,
    );
    console.log(`DB: ${process.env.DB_PATH ?? "./data/positions.db"}`);
    if (health) {
      console.log(
        `Health: GET http://<your-vps-ip>:${health.port}/health  (or curl localhost:${health.port}/health on the server)\n`,
      );
    }
  },
});

const shutdown = () => {
  void (async () => {
    console.log("\n[App] Shutting down...");
    bot.stop();
    if (health) await health.close().catch(() => {});
    process.exit(0);
  })();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
