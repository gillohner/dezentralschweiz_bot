const {
    fetchCalendarEvents
} = require('./nostrUtils');
const {
    escapeHTML,
    formatMeetupsMessage
} = require('./utils');
const config = require('./config');
const {
    setupCommands
} = require('./commands');
const {
    nip19
} = require('nostr-tools');

async function handleStart(bot, msg) {
    const chatId = msg.chat.id;
    const message = `
<b>Willkommen beim Dezentralschweiz Bot! 🇨🇭</b>

Hier sind die verfügbaren Befehle:

/meetups - <i>Zeige bevorstehende Meetups</i>
Erhalte eine Liste aller anstehenden Veranstaltungen in der Dezentralschweiz Community.

/links - <i>Zeige Community-Links</i>
Entdecke wichtige Links und Ressourcen unserer Community.

/meetup_vorschlagen - <i>Schlage ein neues Event vor</i>
Möchtest du ein Meetup organisieren? Nutze diesen Befehl, um dein Event vorzuschlagen.

/refresh_commands - <i>Aktualisiere die Befehlsliste</i>
Aktualisiere die Liste der verfügbaren Befehle, falls Änderungen vorgenommen wurden.

Wir freuen uns, dass du Teil unserer Community bist! Bei Fragen stehen wir dir gerne zur Verfügung.
`;

    await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML'
    });
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
            const chunks = message.match(/.{1,4096}/gs);
            for (const chunk of chunks) {
                await bot.sendMessage(chatId, chunk, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                });
            }
        } else {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
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
        bot.sendMessage(chatId, 'Befehle wurden erfolgreich aktualisiert!');
    } catch (error) {
        console.error('Error refreshing commands:', error);
        bot.sendMessage(chatId, 'Bei der Aktualisierung der Befehle ist ein Fehler aufgetreten. Bitte versuche es später erneut.');
    }
}

function handleSuggestEvent(bot, msg) {
    const chatId = msg.chat.id;
    startEventSuggestion(bot, chatId);
}

module.exports = {
    handleStart,
    handleMeetups,
    handleRefreshCommands,
    handleSuggestEvent
};