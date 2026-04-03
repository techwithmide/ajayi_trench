import "dotenv/config";
import { createBot } from "./bot";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.error(
    "TELEGRAM_BOT_TOKEN is not set. Copy .env.example → .env and fill it in.",
  );
  process.exit(1);
}

const bot = createBot(TOKEN);

bot.catch((err) => {
  console.error("[Bot] Unhandled error: ", err.message);
});

bot.start({
  onStart: (info) => {
    console.log(`Paper trader running as @${info.username}`);
    console.log(`Tracking Solana tokens | TP +100% | SL -50% | Poll 30s`);
    console.log(`DB: ${process.env.DB_PATH ?? "./data/positions.db"}\n`);
  },
});

const shutdown = () => {
  console.log("\n[App] Shutting down...");
  bot.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
