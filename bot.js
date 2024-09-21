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
bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (action.startsWith('links_')) {
    const category = action.split('_')[1];
    const links = communityLinks[category];
    let message = `${category}:\n\n`;
    links.forEach(link => {
      message += `${link.name}\n${link.url}\n\n`;
    });
    await bot.answerCallbackQuery(callbackQuery.id);
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  }
});

async function main() {
  console.log('Bot is starting...');
  await setupCommands(bot);
}

main();