import userStates from "../../userStates.js";
import config from '../../bot/config.js';
import {
    extractTelegramUsername,
    formatLocation,
    formatDate,
    escapeHTML
} from '../../utils/helpers.js'
import {
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
    fetchAndProcessEvents
} from "../../utils/eventUtils.js";
import { getTimeFrameName, getCallbackData } from '../../utils/timeFrameUtils.js';
import url from 'url';


const handleMeetups = async (bot, msg) => {
    const chatId = msg.chat.id;
    const timeFrames = ['heute', 'dieseWoche', '7Tage', '30Tage', 'alle'];
    const keyboard = {
        inline_keyboard: timeFrames.map(timeFrame => [{
            text: getTimeFrameName(timeFrame),
            callback_data: getCallbackData(timeFrame)
        }])
    };

    // Delete the user's /meetup command message
    deleteMessage(bot, chatId, msg.message_id);

    // Delete previous meetup message
    if (userStates[chatId]?.lastMeetupMessageId) {
        deleteMessage(bot, chatId, userStates[chatId].lastMeetupMessageId);
    }
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

const handleMeetupsFilter = async (bot, msg, timeFrame, returnMessage = "lastMeetupMessageId") => {
    const chatId = msg.chat.id;

    try {
        if (userStates[chatId]?.lastMeetupMessageId) {
            await deleteMessage(bot, chatId, userStates[chatId].lastMeetupMessageId);
        }

        const loadingMessage = await bot.sendMessage(chatId, 'Mining new Meetups, bitte warten...', {
            disable_notification: true
        });

        const meetupMessage = await fetchMeetupsLogic(timeFrame);

        const sentMessage = await editAndStoreMessage(
            bot,
            chatId,
            meetupMessage,
            {
                chat_id: chatId,
                message_id: loadingMessage.message_id,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                disable_notification: true,
            },
            returnMessage
        );

        if (returnMessage === 'lastMeetupMessageId') {
            deleteMessageWithTimeout(bot, chatId, sentMessage.message_id);
        }

        return returnMessage ? meetupMessage : undefined;
    } catch (error) {
        console.error('Error in handleMeetupsFilter:', error);
        const errorMessageText = 'Ein Fehler ist beim Mining der Meetups aufgetreten. Bitte versuche es später erneut.';

        if (returnMessage) {
            return errorMessageText;
        }

        const errorMessage = await sendAndStoreMessage(
            bot,
            chatId,
            errorMessageText,
            {
                disable_notification: true
            },
            returnMessage
        );

        deleteMessageWithTimeout(bot, chatId, errorMessage.message_id);
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

                const title = event.tags.find(t => t[0] === 'name')?.[1] || event.tags.find(t => t[0] === 'title')?.[1];
                if (!title) continue;

                const start = event.tags.find(t => t[0] === 'start')?.[1];
                if (!start) continue;

                const end = event.tags.find(t => t[0] === 'end')?.[1];

                const locationTag = event.tags.find(t => t[0] === 'location');
                const location = locationTag ? locationTag[1] : null;

                const eventNaddr = nip19.naddrEncode({
                    kind: event.kind,
                    pubkey: event.pubkey,
                    identifier: event.tags.find(t => t[0] === 'd')?.[1] || '',
                });
                const eventUrl = `https://www.flockstr.com/event/${eventNaddr}`;

                message += `🎉 <b><a href="${eventUrl}">${escapeHTML(title)}</a></b>\n`;
                if (start) {
                    message += `🕒 <b>${formatDate(parseInt(start) * 1000)}</b>`;
                    if (end) message += ` - ${formatDate(parseInt(end) * 1000)}`;
                    message += `\n`;
                }

                const telegramUser = extractTelegramUsername(event.tags);
                if (telegramUser) {
                    message += `👤 ${escapeHTML(telegramUser)}\n`;
                }

                if (location) {
                    const allowedHosts = ['google.com', 'openstreetmap.org', 'maps.apple.com'];
                    const googleMapsLink = event.tags.find(t => {
                        const host = url.parse(t[1]).host;
                        return t[0] === 'r' && allowedHosts.includes(host) && host === 'google.com';
                    })?.[1];
                    const osmLink = event.tags.find(t => {
                        const host = url.parse(t[1]).host;
                        return t[0] === 'r' && allowedHosts.includes(host) && host === 'openstreetmap.org';
                    })?.[1];
                    const appleMapsLink = event.tags.find(t => {
                        const host = url.parse(t[1]).host;
                        return t[0] === 'r' && allowedHosts.includes(host) && host === 'maps.apple.com';
                    })?.[1];
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

const fetchMeetupsLogic = async (timeFrame) => {
    const result = await fetchAndProcessEvents(config, timeFrame);

    if (result.status === 'empty' || result.status === 'noEvents') {
        return result.message;
    }

    return await formatMeetupsMessage(result.events, timeFrame);
};

const getHeaderMessage = (timeFrame) => {
    switch (timeFrame) {
        case 'heute':
            return 'Meetups heute';
        case 'dieseWoche':
            return 'Meetups diese Woche';
        case '7Tage':
            return 'Meetups in den nächsten 7 Tagen';
        case '30Tage':
            return 'Meetups in den nächsten 30 Tagen';
        default:
            return 'Alle bevorstehenden Meetups';
    }
};

export {
    handleMeetups,
    handleMeetupsFilter,
    formatMeetupsMessage,
    getHeaderMessage,
    fetchMeetupsLogic,
};