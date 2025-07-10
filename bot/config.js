import dotenv from "dotenv";

dotenv.config();

const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  MEETSTR_API_URL: process.env.MEETSTR_API_URL,
  DEFAULT_RELAYS: process.env.DEFAULT_RELAYS?.split(",") || [],
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
  MEETUP_CHAT_ID: process.env.MEETUP_CHAT_ID,
  BOT_NSEC: process.env.BOT_NSEC,
  EVENT_CALENDAR_NADDR: process.env.EVENT_CALENDAR_NADDR,
};

export default config;
