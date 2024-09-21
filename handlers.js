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
    extractEventDetails,
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

async function handleAdminApproval(bot, callbackQuery) {
    const action = callbackQuery.data;
    const adminChatId = callbackQuery.message.chat.id;

    if (action.startsWith('approve_delete_') || action.startsWith('reject_delete_')) {
        const userChatId = action.split('_')[2];
        const isApproved = action.startsWith('approve_delete_');
        console.log(`Event deletion ${isApproved ? 'approved' : 'rejected'} for user ${userChatId}`);

        if (isApproved) {
            const eventToDelete = userStates[userChatId].eventToDelete;
            try {
                await handleDeletionConfirmation(bot, callbackQuery, eventToDelete);
                bot.sendMessage(userChatId, 'Ihre Anfrage zur Löschung des Events wurde genehmigt. Das Event wurde gelöscht.');
            } catch (error) {
                console.error('Error deleting event:', error);
                bot.sendMessage(userChatId, 'Es gab einen Fehler beim Löschen des Events. Bitte kontaktieren Sie den Administrator.');
            }
        } else {
            bot.sendMessage(userChatId, 'Ihre Anfrage zur Löschung des Events wurde abgelehnt.');
        }

        bot.answerCallbackQuery(callbackQuery.id, {
            text: isApproved ? 'Löschung genehmigt' : 'Löschung abgelehnt'
        });
        bot.deleteMessage(adminChatId, callbackQuery.message.message_id);
    } else if (action.startsWith('approve_') || action.startsWith('reject_')) {
        const userChatId = action.split('_')[1];
        const isApproved = action.startsWith('approve_');
        console.log(`Event ${isApproved ? 'approved' : 'rejected'} for user ${userChatId}`);

        if (isApproved) {
            const eventDetails = extractEventDetails(callbackQuery.message.text);
            console.log('Extracted event details:', eventDetails);

            try {
                const publishedEvent = await publishEventToNostr(eventDetails);
                console.log('Event published to Nostr:', publishedEvent);

                // Generate Flockstr link
                const eventNaddr = nip19.naddrEncode({
                    kind: publishedEvent.kind,
                    pubkey: publishedEvent.pubkey,
                    identifier: publishedEvent.tags.find(t => t[0] === 'd')?. [1] || '',
                });
                const flockstrLink = `https://www.flockstr.com/event/${eventNaddr}`;

                // Send approval message with Flockstr link
                bot.sendMessage(userChatId, `Dein Event wurde genehmigt und veröffentlicht! Hier ist der Link zu deinem Event auf Flockstr: ${flockstrLink}`);
            } catch (error) {
                console.error('Error publishing event to Nostr:', error);
                bot.sendMessage(userChatId, 'Dein Event wurde genehmigt, konnte aber nicht veröffentlicht werden. Bitte kontaktiere den Administrator.');
            }
        } else {
            bot.sendMessage(userChatId, 'Dein Event-Vorschlag wurde leider nicht genehmigt. Du kannst gerne einen neuen Vorschlag einreichen.');
        }

        bot.answerCallbackQuery(callbackQuery.id, {
            text: isApproved ? 'Event genehmigt' : 'Event abgelehnt'
        });
        bot.deleteMessage(adminChatId, callbackQuery.message.message_id);
    }
}

function filterEventsByTimeFrame(allEvents, timeFrame) {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()), 23, 59, 59);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return allEvents.map(calendar => ({
        ...calendar,
        events: calendar.events.filter(event => {
            const eventDate = new Date(event.start);
            switch (timeFrame) {
                case 'today':
                    return eventDate <= endOfDay;
                case 'week':
                    return eventDate <= endOfWeek;
                case 'month':
                    return eventDate <= endOfMonth;
                default:
                    return true;
            }
        })
    }));
}

async function handleMeetupsFilter(bot, msg, timeFrame) {
    const chatId = msg.chat.id;
    console.log('Fetching calendar events...');
    try {
        await bot.sendMessage(chatId, 'Hole bevorstehende Meetups, bitte warten...');
        let allEvents = [];
        for (const naddr of config.NADDR_LIST) {
            const decoded = nip19.decode(naddr);
            const calendarId = `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`;
            const result = await fetchCalendarEvents(calendarId, naddr);
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

        const filteredEvents = filterEventsByTimeFrame(allEvents, timeFrame);

        if (filteredEvents.every(cal => cal.events.length === 0)) {
            await bot.sendMessage(chatId, `Keine Meetups für den gewählten Zeitraum (${timeFrame}) gefunden.`);
            return;
        }

        const message = formatMeetupsMessage(filteredEvents);
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
        console.error('Error in handleMeetupsFilter:', error);
        await bot.sendMessage(chatId, 'Ein Fehler ist beim Holen der Meetups aufgetreten. Bitte versuche es später erneut.');
    }
}


async function handleMeetups(bot, msg) {
    const chatId = msg.chat.id;
    const keyboard = {
        inline_keyboard: [
            [{
                text: 'Heute',
                callback_data: 'meetups_today'
            }],
            [{
                text: 'Diese Woche',
                callback_data: 'meetups_week'
            }],
            [{
                text: 'Diesen Monat',
                callback_data: 'meetups_month'
            }],
            [{
                text: 'Alle',
                callback_data: 'meetups_all'
            }]
        ]
    };
    await bot.sendMessage(chatId, 'Wähle den Zeitraum für die Meetups:', {
        reply_markup: JSON.stringify(keyboard)
    });
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

function sendDeletionRequestForApproval(bot, userChatId, eventToDelete) {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    let message = `
Löschungsanfrage für Event:
Titel: ${eventToDelete.tags.find(t => t[0] === 'name')?.[1] || 'Ohne Titel'}
Datum: ${new Date(parseInt(eventToDelete.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000).toLocaleString()}
Ort: ${eventToDelete.tags.find(t => t[0] === 'location')?.[1] || 'Kein Ort angegeben'}

Möchten Sie dieses Event löschen?
`;

    const keyboard = {
        inline_keyboard: [
            [{
                    text: 'Genehmigen',
                    callback_data: `approve_delete_${userChatId}`
                },
                {
                    text: 'Ablehnen',
                    callback_data: `reject_delete_${userChatId}`
                }
            ]
        ]
    };

    bot.sendMessage(adminChatId, message, {
        reply_markup: JSON.stringify(keyboard)
    });
    bot.sendMessage(userChatId, 'Ihre Löschungsanfrage wurde zur Genehmigung an die Administratoren gesendet. Wir werden Sie benachrichtigen, sobald eine Entscheidung getroffen wurde.');
}

async function handleDeletionInput(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (userStates[chatId] && userStates[chatId].step === 'awaiting_event_id_for_deletion') {
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
        sendDeletionRequestForApproval(bot, chatId, event);
    }
}


async function handleDeletionConfirmation(bot, query, eventToDelete) {
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
        bot.answerCallbackQuery(query.id, {
            text: 'Event erfolgreich gelöscht'
        });
    } catch (error) {
        console.error('Fehler beim Veröffentlichen des Lösch-Events:', error);
        throw error;
    }
}

module.exports = {
    handleStart,
    handleMeetups,
    handleRefreshCommands,
    handleEventSuggestion,
    handleDeleteEventRequest,
    handleDeletionInput,
    handleAdminApproval,
    handleDeletionConfirmation,
    sendDeletionRequestForApproval,
    handleMeetupsFilter
};