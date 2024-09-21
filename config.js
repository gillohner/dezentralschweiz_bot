require('dotenv').config();

module.exports = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    NADDR_LIST: process.env.NADDR_LIST.split(','),
    DEFAULT_RELAYS: process.env.DEFAULT_RELAYS.split(','),
};