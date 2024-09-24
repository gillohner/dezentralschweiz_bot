import {
    fetchCalendarEvents,
    fetchEventDirectly,
    publishEventToNostr
} from './nostrUtils.js';
import {
    escapeHTML,
    formatMeetupsMessage
} from './utils.js';
import config from './config.js';
import {
    setupCommands
} from './commands.js';
import {
    nip19,
    getPublicKey
} from 'nostr-tools';
import {
    startEventSuggestion,
    handleEventCreationStep,
    handleOptionalField,
    sendEventForApproval,
    extractEventDetails,
    handleCancellation,
    userStates
} from './eventSuggestion.js';
import communityLinks from './communityLinks.js';

const handleStart = async (bot, msg) => {
    const chatId = msg.chat.id;
    const message = `
Willkommen beim Dezentralschweiz Bot! 🇨🇭

Hier sind die verfügbaren Befehle:

/meetups - Zeige bevorstehende Meetups
Erhalte eine Liste aller anstehenden Veranstaltungen in der Dezentralschweiz Community.

/links - Zeige Community-Links
Entdecke wichtige Links und Ressourcen unserer Community.

/meetup_vorschlagen - Schlage ein neues Event vor
Möchtest du ein Meetup organisieren? Nutze diesen Befehl, um dein Event vorzuschlagen.

/refresh_commands - Aktualisiere die Befehlsliste
Aktualisiere die Liste der verfügbaren Befehle, falls Änderungen vorgenommen wurden.

Wir freuen uns, dass du Teil unserer Community bist! Bei Fragen stehen wir dir gerne zur Verfügung.
`;
    await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_notification: true
    });
};

const handleAdminApproval = async (bot, callbackQuery) => {
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

                const eventNaddr = nip19.naddrEncode({
                    kind: publishedEvent.kind,
                    pubkey: publishedEvent.pubkey,
                    identifier: publishedEvent.tags.find(t => t[0] === 'd')?. [1] || '',
                });
                const flockstrLink = `https://www.flockstr.com/event/${eventNaddr}`;

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
};

const filterEventsByTimeFrame = (allEvents, timeFrame) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    return allEvents.map(calendar => ({
        ...calendar,
        events: calendar.events.filter(event => {
            const eventDate = new Date(parseInt(event.tags.find(t => t[0] === 'start')?. [1] || '0') * 1000);
            switch (timeFrame) {
                case 'today':
                    return eventDate >= today && eventDate <= endOfDay;
                case 'week':
                    return eventDate >= today && eventDate <= endOfWeek;
                case 'month':
                    return eventDate >= today && eventDate <= endOfMonth;
                default:
                    return true; // 'all' case
            }
        })
    }));
};

const handleMeetupsFilter = async (bot, msg, timeFrame) => {
    const chatId = msg.chat.id;
    console.log('Fetching calendar events...');
    try {
        await bot.sendMessage(chatId, 'Hole bevorstehende Meetups, bitte warten...', {disable_notification: true});
        let allEvents = [];

        // Log NADDRs being processed
        console.log('NADDR_LIST:', config.NADDR_LIST);

        for (const naddr of config.NADDR_LIST) {
            console.log(`Fetching events for calendar: ${naddr}`);
            const result = await fetchCalendarEvents(naddr);
            if (result && result.calendarName) {
                allEvents.push(result);
                console.log(`Fetched events for calendar: ${result.calendarName}`);
            } else {
                console.error(`Failed to fetch calendar events for ${naddr}`);
            }
        }

        if (allEvents.length === 0) {
            await bot.sendMessage(chatId, 'Keine Kalender oder Meetups gefunden.', {disable_notification: true});
            return;
        }

        const filteredEvents = filterEventsByTimeFrame(allEvents, timeFrame);
        if (filteredEvents.every(cal => cal.events.length === 0)) {
            await bot.sendMessage(chatId, `Keine Meetups für den gewählten Zeitraum (${timeFrame}) gefunden.`, {disable_notification: true});
            return;
        }

        const message = await formatMeetupsMessage(filteredEvents);
        if (message.length > 4096) {
            const chunks = message.match(/.{1,4096}/gs);
            for (const chunk of chunks) {
                await bot.sendMessage(chatId, chunk, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                    disable_notification: true
                });
            }
        } else {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                disable_notification: true,
                disable_notification: true
            });
        }
    } catch (error) {
        console.error('Error in handleMeetupsFilter:', error);
        await bot.sendMessage(chatId, 'Ein Fehler ist beim Holen der Meetups aufgetreten. Bitte versuche es später erneut.', {disable_notification: true});
    }
};

const handleMeetups = async (bot, msg) => {
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
        reply_markup: JSON.stringify(keyboard),
        disable_notification: true
    });
};

const handleRefreshCommands = async (bot, msg) => {
    const chatId = msg.chat.id;
    try {
        await setupCommands(bot);
        bot.sendMessage(chatId, 'Befehle wurden erfolgreich aktualisiert!', {disable_notification: true});
    } catch (error) {
        console.error('Error refreshing commands:', error);
        bot.sendMessage(chatId, 'Bei der Aktualisierung der Befehle ist ein Fehler aufgetreten. Bitte versuche es später erneut.', {disable_notification: true});
    }
};

const handleEventSuggestion = (bot, msg) => {
    const chatId = msg.chat.id;
    startEventSuggestion(bot, chatId, msg);
};

const handleDeleteEventRequest = (bot, msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = {
        step: 'awaiting_event_id_for_deletion'
    };
    bot.sendMessage(chatId, "Bitte geben Sie die Event-ID oder NADDR des zu löschenden Events ein, oder /cancel um abzubrechen:", {disable_notification: true});
};

const sendDeletionRequestForApproval = (bot, userChatId, eventToDelete) => {
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
    bot.sendMessage(userChatId, 'Ihre Löschungsanfrage wurde zur Genehmigung an die Administratoren gesendet. Wir werden Sie benachrichtigen, sobald eine Entscheidung getroffen wurde.', {disable_notification: true});
};

const handleDeletionInput = async (bot, msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!userStates[chatId] || userStates[chatId].step !== 'awaiting_event_id_for_deletion') {
        return; // Exit if we're not expecting a deletion input
    }

    if (text.toLowerCase() === '/cancel') {
        delete userStates[chatId];
        bot.sendMessage(chatId, "Löschungsvorgang abgebrochen.", {disable_notification: true});
        return;
    }

    let filter;
    try {
        const decoded = nip19.decode(text);
        if (decoded.type === 'note') {
            filter = {
                ids: [decoded.data]
            };
        } else if (decoded.type === 'naddr') {
            filter = {
                kinds: [decoded.data.kind],
                authors: [decoded.data.pubkey],
                "#d": [decoded.data.identifier]
            };
        } else {
            throw new Error('Unsupported Nostr type');
        }
    } catch (error) {
        console.error('Fehler beim Dekodieren von NADDR:', error);
        bot.sendMessage(chatId, "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut oder geben Sie /cancel ein, um abzubrechen.", {disable_notification: true});
        return;
    }

    if (!filter) {
        bot.sendMessage(chatId, "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut oder geben Sie /cancel ein, um abzubrechen.", {disable_notification: true});
        return;
    }

    console.log('Fetching event with filter:', filter);
    const event = await fetchEventDirectly(filter);
    if (!event) {
        bot.sendMessage(chatId, "Event nicht gefunden. Bitte überprüfen Sie die ID und versuchen Sie es erneut oder geben Sie /cancel ein, um abzubrechen.", {disable_notification: true});
        return;
    }

    userStates[chatId].eventToDelete = event;
    delete userStates[chatId].step; // Remove the step to stop looking for NADDR
    sendDeletionRequestForApproval(bot, chatId, event);
};

const handleDeletionConfirmation = async (bot, query, eventToDelete) => {
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
};

const handleMessage = (bot, msg) => {
    if (msg.chat.type === 'private') {
        const chatId = msg.chat.id;
        if (userStates[chatId]?.step === 'awaiting_event_id_for_deletion') {
            handleDeletionInput(bot, msg);
        } else {
            handleEventCreationStep(bot, msg);
        }
    }
};

const handleLinks = (bot, msg, communityLinks) => {
    const chatId = msg.chat.id;
    const keyboard = {
        inline_keyboard: Object.keys(communityLinks).map(category => [{
            text: category,
            callback_data: `links_${category}`
        }])
    };
    bot.sendMessage(chatId, 'Wähle eine Kategorie:', {
        reply_markup: JSON.stringify(keyboard),
        disable_notification: true
    });
};

const handleCallbackQuery = async (bot, callbackQuery) => {
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
            disable_notification: true
        });
    } else if (action.startsWith('approve_') || action.startsWith('reject_')) {
        await handleAdminApproval(bot, callbackQuery);
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
            bot.sendMessage(chatId, "Es tut mir leid, aber ich habe keine Informationen über dein Event. Bitte starte den Prozess erneut mit /meetup_vorschlagen.", {disable_notification: true});
        }
    } else if (action === 'cancel_creation') {
        handleCancellation(bot, chatId);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Meetup-Erstellung abgebrochen'
        });
        await bot.deleteMessage(chatId, msg.message_id);
    }
};

const handleMeetupSuggestion = (bot, msg) => {
    if (msg.chat.type !== 'private') {
        bot.sendMessage(msg.chat.id, 'Dieser Befehl funktioniert nur in privaten Nachrichten. Bitte sende mir eine direkte Nachricht, um ein Meetup vorzuschlagen.', {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: 'Zum Bot',
                        url: `https://t.me/${bot.username}`
                    }]
                ]
            },
            disable_notification: true
        });
        return;
    }
    handleEventSuggestion(bot, msg);
};

const handleMeetupDeletion = (bot, msg) => {
    if (msg.chat.type !== 'private') {
        bot.sendMessage(msg.chat.id, 'Dieser Befehl funktioniert nur in privaten Nachrichten. Bitte sende mir eine direkte Nachricht, um eine Eventlöschung anzufordern.', {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: 'Zum Bot',
                        url: `https://t.me/${bot.username}`
                    }]
                ]
            },
            disable_notification: true
        });
        return;
    }
    handleDeleteEventRequest(bot, msg);
};

export {
    handleStart,
    handleMeetups,
    handleRefreshCommands,
    handleEventSuggestion,
    handleDeleteEventRequest,
    handleDeletionInput,
    handleAdminApproval,
    handleDeletionConfirmation,
    sendDeletionRequestForApproval,
    handleMeetupsFilter,
    handleMessage,
    handleCallbackQuery,
    handleLinks,
    handleMeetupSuggestion,
    handleMeetupDeletion
};