import TelegramBot from 'node-telegram-bot-api';
import config from './config.js';
import {
  setupCommands
} from './commands.js';
import * as handlers from './handlers.js';
import communityLinks from './communityLinks.js';
import * as eventSuggestion from './eventSuggestion.js';

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
  polling: true
});

const initializeBot = async (bot) => {
  try {
    const botInfo = await bot.getMe();
    bot.username = botInfo.username;
    console.log(`Bot initialized. Username: @${bot.username}`);
  } catch (error) {
    console.error('Error initializing bot:', error);
  }
};

const setupEventHandlers = (bot) => {
  bot.onText(/\/start/, (msg) => handlers.handleStart(bot, msg));
  bot.onText(/\/meetups/, (msg) => handlers.handleMeetups(bot, msg));
  bot.onText(/\/refresh_commands/, (msg) => handlers.handleRefreshCommands(bot, msg));
  bot.onText(/\/links/, (msg) => handlers.handleLinks(bot, msg, communityLinks));
  bot.onText(/\/meetup_vorschlagen/, (msg) => handlers.handleMeetupSuggestion(bot, msg));
  bot.onText(/\/meetup_loeschen/, (msg) => handlers.handleMeetupDeletion(bot, msg));
  bot.onText(/\/getgroupid/, (msg) => handlers.handleGetGroupId(bot, msg));
  bot.on('message', (msg) => handlers.handleMessage(bot, msg));
  bot.on('callback_query', (callbackQuery) => handlers.handleCallbackQuery(bot, callbackQuery));
  bot.on("polling_error", (error) => console.log("Polling error:", error));
};

const main = async () => {
  console.log('Bot wird gestartet...');
  await setupCommands(bot);
  await initializeBot(bot);
  setupEventHandlers(bot);
};

main();