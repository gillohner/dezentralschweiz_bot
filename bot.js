import TelegramBot from 'node-telegram-bot-api';
import config from './config.js';
import {
  setupCommands
} from './commands.js';
import * as handlers from './handlers.js';
import communityLinks from './communityLinks.js';
import * as eventSuggestion from './eventSuggestion.js';
import {
  handleMeetupSuggestion
} from './handlers/meetupHandlers/meetupSuggestionHandler.js'
import {
  handleMeetups
} from './handlers/meetupHandlers/meetupDisplayingHandler.js'
import {
  handleLinks
} from './handlers/linkHandler.js'
import {
  handleCallbackQuery
} from './handlers/callbackHandler.js'
import {
  handleRefreshCommands
} from './handlers/refreshCommandsHandler.js'


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
  bot.onText(/\/meetups/, (msg) => handleMeetups(bot, msg));
  bot.onText(/\/refresh_commands/, (msg) => handleRefreshCommands(bot, msg));
  bot.onText(/\/links/, (msg) => handleLinks(bot, msg, communityLinks));
  bot.onText(/\/meetup_vorschlagen/, (msg) => handleMeetupSuggestion(bot, msg));
  bot.onText(/\/meetup_loeschen/, (msg) => handlers.handleMeetupDeletion(bot, msg));
  bot.onText(/\/getgroupid/, (msg) => handlers.handleGetGroupId(bot, msg));
  bot.on('message', (msg) => handlers.handleMessage(bot, msg));
  bot.on('callback_query', (callbackQuery) => handleCallbackQuery(bot, callbackQuery));
  bot.on("polling_error", (error) => console.log("Polling error:", error));
  bot.on('new_chat_members', (msg) => handlers.handleNewMember(bot, msg));
};

const main = async () => {
  console.log('Bot wird gestartet...');
  await setupCommands(bot);
  await initializeBot(bot);
  setupEventHandlers(bot);
};

main();