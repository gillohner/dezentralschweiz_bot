// bot.js
// External Libraries
import TelegramBot from "node-telegram-bot-api";

// Config
import config from "./bot/config.js";

// Import Tasks
import { scheduleWeeklyMeetupPost } from "./scheduledTasks.js";
import { startCalendarEventListener } from "./handlers/calendarEventRequestHandler.js";

// Handlers
import { setupCommands } from "./bot/commands.js";
import { handleMeetupSuggestion } from "./handlers/meetupHandlers/meetupSuggestionHandler.js";
import { handleMeetups } from "./handlers/meetupHandlers/meetupDisplayingHandler.js";
import { handleLinks } from "./handlers/linkHandler.js";
import { handleCallbackQuery } from "./handlers/callbackHandler.js";
import { handleRefreshCommands } from "./handlers/refreshCommandsHandler.js";
import { handleMeetupDeletion } from "./handlers/meetupHandlers/meetupDeletionHandler.js";
import { handleNewMember } from "./handlers/newMemberHandler.js";
import { handleMessage } from "./handlers/messageHandler.js";
import { handleStart } from "./handlers/startHandler.js";
import { handleHelp } from "./handlers/helpHandler.js";

// Datasets
import communityLinks from "./datasets/communityLinks.js";

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
  polling: true,
});

const initializeBot = async (bot) => {
  try {
    const botInfo = await bot.getMe();
    bot.username = botInfo.username;
  } catch (error) {
    console.error("Error initializing bot:", error);
  }
};

const setupEventHandlers = (bot) => {
  bot.onText(/\/start/, (msg) => handleStart(bot, msg));
  bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
  bot.onText(/\/meetups/, (msg) => handleMeetups(bot, msg));
  bot.onText(/\/refresh_commands/, (msg) => handleRefreshCommands(bot, msg));
  bot.onText(/\/links/, (msg) => handleLinks(bot, msg, communityLinks));
  bot.onText(/\/meetup_vorschlagen/, (msg) => handleMeetupSuggestion(bot, msg));
  bot.onText(/\/meetup_loeschen/, (msg) => handleMeetupDeletion(bot, msg));
  bot.on("new_chat_members", (msg) => handleNewMember(bot, msg));
  bot.on("message", (msg) => handleMessage(bot, msg));
  bot.on("callback_query", (callbackQuery) =>
    handleCallbackQuery(bot, callbackQuery)
  );
  bot.on("polling_error", (error) => console.log("Polling error:", error));
};

const main = async () => {
  console.log("Booting up the Nostr...");
  await setupCommands(bot);
  await initializeBot(bot);
  setupEventHandlers(bot);
  scheduleWeeklyMeetupPost(bot);
  startCalendarEventListener(bot);
};

main();
