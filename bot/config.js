import dotenv from 'dotenv';

dotenv.config();

const config = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    NADDR_LIST: process.env.NADDR_LIST?.split(',') || [],
    DEFAULT_RELAYS: process.env.DEFAULT_RELAYS?.split(',') || [],
    FETCH_RELAY: process.env.FETCH_RELAY,
    ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
    BOT_NSEC: process.env.BOT_NSEC,
    EVENT_CALENDAR_NADDR: process.env.EVENT_CALENDAR_NADDR,
};

export default config;