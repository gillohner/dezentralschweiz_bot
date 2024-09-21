const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const {
  setupCommands
} = require('./commands');
const {
  handleStart,
  handleMeetups,
  handleRefreshCommands,
  handleEventSuggestion,
  handleDeleteEventRequest,
  handleDeletionInput,
  handleDeletionConfirmation,
  handleAdminApproval,
  handleMeetupsFilter
} = require('./handlers');
const communityLinks = require('./communityLinks');
const {
  startEventSuggestion,
  handleEventCreationStep,
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
  if (msg.chat.type !== 'private') {
    bot.sendMessage(msg.chat.id, 'Dieser Befehl funktioniert nur in privaten Nachrichten. Bitte sende mir eine direkte Nachricht, um ein Meetup vorzuschlagen.', {
      reply_markup: {
        inline_keyboard: [
          [{
            text: 'Zum Bot',
            url: `https://t.me/${bot.username}`
          }]
        ]
      }
    });
    return;
  }
  handleEventSuggestion(bot, msg);
});

bot.onText(/\/meetup_loeschen/, (msg) => {
  if (msg.chat.type !== 'private') {
    bot.sendMessage(msg.chat.id, 'Dieser Befehl funktioniert nur in privaten Nachrichten. Bitte sende mir eine direkte Nachricht, um eine Eventlöschung anzufordern.', {
      reply_markup: {
        inline_keyboard: [
          [{
            text: 'Zum Bot',
            url: `https://t.me/${bot.username}`
          }]
        ]
      }
    });
    return;
  }
  handleDeleteEventRequest(bot, msg);
});

bot.on('message', (msg) => {
  if (msg.chat.type === 'private') {
    if (userStates[msg.chat.id]?.step === 'awaiting_event_id_for_deletion') {
      handleDeletionInput(bot, msg);
    } else {
      handleEventCreationStep(bot, msg);
    }
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (action.startsWith('meetups_')) {
    const timeFrame = action.split('_')[1];
    await handleMeetupsFilter(bot, msg, timeFrame);
  } else if (action.startsWith('links_')) {
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

async function initializeBot(bot) {
  try {
    const botInfo = await bot.getMe();
    bot.username = botInfo.username;
    console.log(`Bot initialized. Username: @${bot.username}`);
  } catch (error) {
    console.error('Error initializing bot:', error);
  }
}

async function main() {
  console.log('Bot wird gestartet...');
  await setupCommands(bot);
  await initializeBot(bot);
}

main();