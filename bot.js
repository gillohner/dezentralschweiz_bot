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
const communityLinks = require('./communityLinks');
const {
  startEventSuggestion,
  handleEventCreationStep,
  handleAdminApproval,
  handleOptionalField,
  sendEventForApproval,
  userStates
} = require('./eventSuggestion');

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
  polling: true
});

bot.onText(/\/start/, (msg) => handleStart(bot, msg));

bot.onText(/\/meetups/, (msg) => handleMeetups(bot, msg));

bot.onText(/\/refresh_commands/, (msg) => handleRefreshCommands(bot, msg));

bot.onText(/\/links/, (msg) => {
  const chatId = msg.chat.id;
  const keyboard = {
    inline_keyboard: Object.keys(communityLinks).map(category => [{
      text: category,
      callback_data: `links_${category}`
    }])
  };
  bot.sendMessage(chatId, 'Wähle eine Kategorie:', {
    reply_markup: JSON.stringify(keyboard)
  });
});

bot.onText(/\/meetup_vorschlagen/, (msg) => {
  const chatId = msg.chat.id;
  startEventSuggestion(bot, chatId, msg);
});

bot.on('message', (msg) => {
  if (msg.chat.type === 'private') {
    handleEventCreationStep(bot, msg);
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (action.startsWith('links_')) {
    const category = action.split('_')[1];
    const links = communityLinks[category];
    let message = `<b>${category}:</b>\n\n`;
    links.forEach(link => {
      message += `${link.name}\n${link.url}\n\n`;
    });
    await bot.answerCallbackQuery(callbackQuery.id);
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  } else if (action.startsWith('approve_') || action.startsWith('reject_')) {
    handleAdminApproval(bot, callbackQuery);
  } else if (action === 'add_end_date') {
    handleOptionalField(bot, chatId, 'end_date');
  } else if (action === 'add_image') {
    handleOptionalField(bot, chatId, 'image');
  } else if (action === 'add_about') {
    handleOptionalField(bot, chatId, 'about');
  } else if (action === 'send_for_approval') {
    if (userStates[chatId]) {
      sendEventForApproval(bot, chatId, userStates[chatId]);
      delete userStates[chatId];
    } else {
      bot.sendMessage(chatId, "Es tut mir leid, aber ich habe keine Informationen über dein Event. Bitte starte den Prozess erneut mit /meetup_vorschlagen.");
    }
  }
});

bot.on("polling_error", (error) => {
  console.log("Polling error:", error);
});

async function main() {
  console.log('Bot wird gestartet...');
  await setupCommands(bot);
}

main();
