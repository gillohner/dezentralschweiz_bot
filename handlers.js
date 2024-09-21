const { fetchCalendarEvents } = require('./nostrUtils');
const { escapeHTML, formatMeetupsMessage } = require('./utils');
const config = require('./config');
const { setupCommands } = require('./commands');
const { nip19 } = require('nostr-tools');

async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Willkommen beim Dezentralschweiz Bot! Verwende /meetups, um bevorstehende Meetups zu sehen.');
}

async function handleMeetups(bot, msg) {
    const chatId = msg.chat.id;
    console.log('Fetching calendar events...');
    try {
        await bot.sendMessage(chatId, 'Hole bevorstehende Meetups, bitte warten...');
        let allEvents = [];
        for (const naddr of config.NADDR_LIST) {
            const decoded = nip19.decode(naddr);
            const calendarId = `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`;
            const result = await fetchCalendarEvents(calendarId, naddr);
            console.log('Fetched calendar result:', result);
            if (result && result.calendarName) {
                allEvents.push(result);
            } else {
                console.error(`Failed to fetch calendar events for ${calendarId}`);
            }
        }
        
        if (allEvents.length === 0) {
            await bot.sendMessage(chatId, 'Keine Kalender oder Meetups gefunden.');
            return;
        }

        if (allEvents.every(cal => cal.events.length === 0)) {
            await bot.sendMessage(chatId, 'Keine bevorstehenden Meetups gefunden.');
            return;
        }

        const message = formatMeetupsMessage(allEvents);
        
        if (message.length > 4096) {
            // If the message is too long, split it into multiple messages
            const chunks = message.match(/.{1,4096}/gs);
            for (const chunk of chunks) {
                await bot.sendMessage(chatId, chunk, { parse_mode: 'HTML', disable_web_page_preview: true });
            }
        } else {
            await bot.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true });
        }
    } catch (error) {
        console.error('Error in /meetups command:', error);
        await bot.sendMessage(chatId, 'Ein Fehler ist beim Holen der Meetups aufgetreten. Bitte versuche es später erneut.');
    }
}

async function handleRefreshCommands(bot, msg) {
  const chatId = msg.chat.id;
  try {
    await setupCommands(bot);
    bot.sendMessage(chatId, 'Commands refreshed successfully!');
  } catch (error) {
    console.error('Error refreshing commands:', error);
    bot.sendMessage(chatId, 'An error occurred while refreshing commands. Please try again later.');
  }
}

module.exports = { handleStart, handleMeetups, handleRefreshCommands };
