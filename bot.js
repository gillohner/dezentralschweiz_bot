const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const {
  setupCommands
} = require('./commands');
const {
  handleStart,
  handleMeetups,
  handleRefreshCommands
} = require('./handlers');

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
  polling: true
});

bot.onText(/\/start/, (msg) => handleStart(bot, msg));
bot.onText(/\/meetups/, (msg) => handleMeetups(bot, msg));
bot.onText(/\/refresh_commands/, (msg) => handleRefreshCommands(bot, msg));

async function main() {
  console.log('Bot is starting...');
  await setupCommands(bot);
}

main();