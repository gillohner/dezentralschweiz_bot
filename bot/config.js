import dotenv from "dotenv";

dotenv.config();

const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  MEETSTR_API_URL: process.env.MEETSTR_API_URL,
  DEFAULT_RELAYS: process.env.DEFAULT_RELAYS?.split(",")
    .map((relay) => relay.trim())
    .filter(Boolean) || [
    "wss://relay.nostr.band",
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
  ],
  NADDR_LIST:
    process.env.NADDR_LIST?.split(",")
      .map((naddr) => naddr.trim())
      .filter(Boolean) || [],
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
  MEETUP_CHAT_ID: process.env.MEETUP_CHAT_ID,
  LOGS_CHAT_ID: process.env.LOGS_CHAT_ID,
  BOT_NSEC: process.env.BOT_NSEC,
  EVENT_CALENDAR_NADDR: process.env.EVENT_CALENDAR_NADDR,
  BLOSSOM_SERVER: process.env.BLOSSOM_SERVER || "https://blossom.nostr.build",
};

export default config;
