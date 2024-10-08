import userStates from "../../userStates.js";
import config from '../../bot/config.js';
import {
    extractTelegramUsername,
    formatLocation,
    formatDate,
    escapeHTML
} from '../../utils/helpers.js'
import {
    fetchCalendarEvents,
    checkForDeletionEvent
} from '../../utils/nostrUtils.js';
import {
    nip19
} from 'nostr-tools';
import {
    deleteMessageWithTimeout,
    sendAndStoreMessage,
    deleteMessage,
    editAndStoreMessage
} from "../../utils/helpers.js";
import {
    fetchAndFilterEvents,
    filterEventsByTimeFrame
} from "../../utils/eventUtils.js";


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

    // Delete the user's /meetup command message
    deleteMessage(bot, chatId, msg.message_id);

    // Delete previous meetup message
    if (userStates[chatId]?.lastMeetupMessageId) {
        deleteMessage(bot, chatId, userStates[chatId].lastMeetupMessageId);
    };
    const sentMessage = await sendAndStoreMessage(
        bot,
        chatId,
        'Wähle den Zeitraum für die Meetups:', {
            reply_markup: JSON.stringify(keyboard),
            disable_notification: true
        },
        'lastMeetupMessageId'
    );
    deleteMessageWithTimeout(bot, chatId, sentMessage.message_id);
};

const handleMeetupsFilter = async (bot, msg, timeFrame) => {
    const chatId = msg.chat.id;

    try {
        // Delete the previous message if it exists
        if (userStates[chatId]?.lastMeetupMessageId) {
            deleteMessage(bot, chatId, userStates[chatId].lastMeetupMessageId);
        }

        const loadingMessage = await bot.sendMessage(chatId, 'Mining new Meetups, bitte warten...', {
            disable_notification: true
        });

        let allEvents = await fetchAndFilterEvents(config, timeFrame);

        if (allEvents.length === 0) {
            const sentMessage = await editAndStoreMessage(
                bot,
                chatId,
                'Keine Kalender oder Meetups gefunden.', {
                    chat_id: chatId,
                    message_id: loadingMessage.message_id,
                    disable_notification: true
                },
                'lastMeetupMessageId'
            );

            deleteMessageWithTimeout(bot, chatId, sentMessage.message_id)

            return;
        }

        const filteredEvents = filterEventsByTimeFrame(allEvents, timeFrame);

        console.log("ejhje")
        if (filteredEvents.every(cal => cal.events.length === 0)) {
            const sentMessage = await editAndStoreMessage(
                bot,
                chatId,
                `Keine Meetups für den gewählten Zeitraum (${timeFrame}) gefunden.`, {
                    chat_id: chatId,
                    message_id: loadingMessage.message_id,
                    disable_notification: true
                },
                'lastMeetupMessageId'
            )

            deleteMessageWithTimeout(bot, chatId, sentMessage.message_id)

            return;
        }

        const meetupMessage = await formatMeetupsMessage(filteredEvents, timeFrame);

        const sentMessage = editAndStoreMessage(
            bot,
            chatId,
            meetupMessage, {
                chat_id: chatId,
                message_id: loadingMessage.message_id,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                disable_notification: true,
            },
            'lastMeetupMessageId'
        );

        deleteMessageWithTimeout(bot, chatId, sentMessage.message_id)
    } catch (error) {
        console.error('Error in handleMeetupsFilter:', error);
        const errorMessage = await sendAndStoreMessage(
            bot,
            chatId,
            'Ein Fehler ist beim Mining der Meetups aufgetreten. Bitte versuche es später erneut.', {
                disable_notification: true
            },
            'lastMeetupMessageId'
        );

        deleteMessageWithTimeout(bot, chatId, errorMessage.message_id)
    }
};
const formatMeetupsMessage = async (allEvents, timeFrame) => {
    let message = `🍻 <b>${getHeaderMessage(timeFrame)}</b> 🍻\n\n`;

    for (const {
            calendarName,
            events,
            naddr
        } of allEvents) {
        if (events.length > 0) {
            const calendarUrl = `https://www.flockstr.com/calendar/${naddr}`;
            message += `<b>📅 <a href="${calendarUrl}">${escapeHTML(calendarName)}</a></b>\n\n`;

            for (let i = 0; i < events.length; i++) {
                const event = events[i];

                if (await checkForDeletionEvent(event.id)) continue;

                const title = event.tags.find(t => t[0] === 'name')?. [1] || event.tags.find(t => t[0] === 'title')?. [1];
                if (!title) continue;

                const start = event.tags.find(t => t[0] === 'start')?. [1];
                if (!start) continue;

                const end = event.tags.find(t => t[0] === 'end')?. [1];

                const locationTag = event.tags.find(t => t[0] === 'location');
                const location = locationTag ? locationTag[1] : null;

                const eventNaddr = nip19.naddrEncode({
                    kind: event.kind,
                    pubkey: event.pubkey,
                    identifier: event.tags.find(t => t[0] === 'd')?. [1] || '',
                });
                const eventUrl = `https://www.flockstr.com/event/${eventNaddr}`;

                message += `🎉 <b><a href="${eventUrl}">${escapeHTML(title)}</a></b>\n`;
                if (start) {
                    message += `🕒 ${formatDate(parseInt(start) * 1000)}`;
                    if (end) message += ` - ${formatDate(parseInt(end) * 1000)}`;
                    message += `\n`;
                }

                const telegramUser = extractTelegramUsername(event.tags);
                if (telegramUser) {
                    message += `👤 ${escapeHTML(telegramUser)}\n`;
                }

                if (location) {
                    const googleMapsLink = event.tags.find(t => t[0] === 'r' && t[1].includes('google.com/maps'))?. [1];
                    const osmLink = event.tags.find(t => t[0] === 'r' && t[1].includes('openstreetmap.org'))?. [1];
                    const appleMapsLink = event.tags.find(t => t[0] === 'r' && t[1].includes('maps.apple.com'))?. [1];
                    message += formatLocation(location, googleMapsLink, osmLink, appleMapsLink);
                }

                // Add separator only if this is not the last event
                if (i < events.length - 1) {
                    message += '\n🔶♦️🔶♦️🔶♦️🔶♦️🔶♦️🔶♦️🔶\n\n';
                }
            }
        }
    }

    return message;
};

const getHeaderMessage = (timeFrame) => {
    switch (timeFrame) {
        case 'today':
            return 'Meetups heute';
        case 'week':
            return 'Meetups diese Woche';
        case 'month':
            return 'Meetups diesen Monat';
        default:
            return 'Alle bevorstehenden Meetups';
    }
};

export {
    handleMeetups,
    handleMeetupsFilter,
    formatMeetupsMessage,
    getHeaderMessage,
};