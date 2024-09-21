const {
    fetchCalendarEvents,
    fetchEventDirectly,
    publishEventToNostr
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
    nip19,
    getPublicKey
} = require('nostr-tools');
const {
    startEventSuggestion,
    userStates
} = require('./eventSuggestion');

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

function handleEventSuggestion(bot, msg) {
    const chatId = msg.chat.id;
    startEventSuggestion(bot, chatId, msg);
}

function handleDeleteEventRequest(bot, msg) {
    const chatId = msg.chat.id;
    userStates[chatId] = {
        step: 'awaiting_event_id_for_deletion'
    };
    bot.sendMessage(chatId, "Bitte geben Sie die Event-ID oder NADDR des zu löschenden Events ein:");
}

async function handleDeletionInput(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (userStates[chatId].step === 'awaiting_event_id_for_deletion') {
        let eventId, pubkey, kind;
        try {
            if (text.startsWith('nostr:')) {
                const decoded = nip19.decode(text.slice(6));
                if (decoded.type === 'note') {
                    eventId = decoded.data;
                } else if (decoded.type === 'naddr') {
                    eventId = decoded.data.identifier;
                    pubkey = decoded.data.pubkey;
                    kind = decoded.data.kind;
                }
            } else {
                eventId = text;
            }
        } catch (error) {
            console.error('Fehler beim Dekodieren von NADDR:', error);
            bot.sendMessage(chatId, "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut.");
            return;
        }

        if (!eventId) {
            bot.sendMessage(chatId, "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut.");
            return;
        }

        const event = await fetchEventDirectly({
            ids: [eventId]
        });
        if (!event) {
            bot.sendMessage(chatId, "Event nicht gefunden. Bitte überprüfen Sie die ID und versuchen Sie es erneut.");
            return;
        }

        userStates[chatId].eventToDelete = event;
        const message = `
Event gefunden:
Titel: ${event.tags.find(t => t[0] === 'name')?.[1] || 'Ohne Titel'}
Datum: ${new Date(parseInt(event.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000).toLocaleString()}
Ort: ${event.tags.find(t => t[0] === 'location')?.[1] || 'Kein Ort angegeben'}

Sind Sie sicher, dass Sie dieses Event löschen möchten?
`;

        const keyboard = {
            inline_keyboard: [
                [{
                    text: 'Ja, löschen',
                    callback_data: 'confirm_delete'
                }],
                [{
                    text: 'Nein, abbrechen',
                    callback_data: 'cancel_delete'
                }]
            ]
        };

        bot.sendMessage(chatId, message, {
            reply_markup: keyboard
        });
        userStates[chatId].step = 'awaiting_deletion_confirmation';
    }
}

async function handleDeletionConfirmation(bot, query) {
    const chatId = query.message.chat.id;

    if (query.data === 'confirm_delete') {
        const eventToDelete = userStates[chatId].eventToDelete;
        const privateKey = process.env.BOT_NSEC;
        if (!privateKey) {
            throw new Error('BOT_NSEC is not set in the environment variables');
        }
        const publicKey = getPublicKey(privateKey);

        const deleteEvent = {
            kind: 5,
            pubkey: publicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['e', eventToDelete.id],
                ['a', `31923:${eventToDelete.pubkey}:${eventToDelete.tags.find(t => t[0] === 'd')?.[1]}`]
            ],
            content: 'Event von Admin gelöscht'
        };

        try {
            await publishEventToNostr(deleteEvent);
            bot.answerCallbackQuery(query.id, { text: 'Event erfolgreich gelöscht' });
            bot.sendMessage(chatId, 'Das Event wurde gelöscht.');
        } catch (error) {
            console.error('Fehler beim Veröffentlichen des Lösch-Events:', error);
            bot.answerCallbackQuery(query.id, { text: 'Fehler beim Löschen des Events' });
            bot.sendMessage(chatId, 'Es gab einen Fehler beim Löschen des Events. Bitte versuchen Sie es später erneut.');
        }
    } else if (query.data === 'cancel_delete') {
        bot.answerCallbackQuery(query.id, { text: 'Löschvorgang abgebrochen' });
        bot.sendMessage(chatId, 'Löschvorgang des Events abgebrochen.');
    }

    delete userStates[chatId];
}

module.exports = {
    handleStart,
    handleMeetups,
    handleRefreshCommands,
    handleEventSuggestion,
    handleDeleteEventRequest,
    handleDeletionInput,
    handleDeletionConfirmation
};