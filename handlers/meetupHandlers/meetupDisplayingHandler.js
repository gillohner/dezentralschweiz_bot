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
    try {
        await bot.deleteMessage(chatId, msg.message_id);
    } catch (error) {
        console.error('Error deleting user command message:', error);
    }

    // Delete the previous meetup message if it exists
    if (userStates[chatId]?.lastMeetupMessageId) {
        try {
            await bot.deleteMessage(chatId, userStates[chatId].lastMeetupMessageId);
        } catch (error) {
            console.error('Error deleting previous meetup message:', error);
        }
    }

    // Send new message and store its ID
    const sentMessage = await bot.sendMessage(chatId, 'Wähle den Zeitraum für die Meetups:', {
        reply_markup: JSON.stringify(keyboard),
        disable_notification: true
    });

    // Update the stored message ID with the new meetup list message
    userStates[chatId] = {
        ...userStates[chatId],
        lastMeetupMessageId: sentMessage.message_id
    };

    // Set a timer to delete the message after 5 minutes
    setTimeout(async () => {
        try {
            await bot.deleteMessage(chatId, sentMessage.message_id);
            delete userStates[chatId].lastMeetupMessageId;
        } catch (error) {
            console.error('Error deleting meetup list message:', error);
        }
    }, 5 * 60 * 1000);
};

const handleMeetupsFilter = async (bot, msg, timeFrame) => {
    const chatId = msg.chat.id;

    try {
        // Delete the previous message if it exists
        if (userStates[chatId]?.lastMeetupMessageId) {
            try {
                await bot.deleteMessage(chatId, userStates[chatId].lastMeetupMessageId);
            } catch (error) {
                console.error('Error deleting previous message:', error);
            }
        }

        const loadingMessage = await bot.sendMessage(chatId, 'Mining new Meetups, bitte warten...', {
            disable_notification: true
        });

        let allEvents = [];
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
            const sentMessage = await bot.editMessageText('Keine Kalender oder Meetups gefunden.', {
                chat_id: chatId,
                message_id: loadingMessage.message_id,
                disable_notification: true
            });
            userStates[chatId] = {
                ...userStates[chatId],
                lastMeetupMessageId: sentMessage.message_id
            };

            // Set a timer to delete the "no meetups" message after 5 minutes
            setTimeout(async () => {
                try {
                    await bot.deleteMessage(chatId, sentMessage.message_id);
                    delete userStates[chatId].lastMeetupMessageId;
                } catch (error) {
                    console.error('Error deleting "no meetups" message:', error);
                }
            }, 5 * 60 * 1000);

            return;
        }

        const filteredEvents = sortEventsByStartDate(filterEventsByTimeFrame(allEvents, timeFrame));

        if (filteredEvents.every(cal => cal.events.length === 0)) {
            const sentMessage = await bot.editMessageText(`Keine Meetups für den gewählten Zeitraum (${timeFrame}) gefunden.`, {
                chat_id: chatId,
                message_id: loadingMessage.message_id,
                disable_notification: true
            });
            userStates[chatId] = {
                ...userStates[chatId],
                lastMeetupMessageId: sentMessage.message_id
            };

            // Set a timer to delete the "no meetups" message after 5 minutes
            setTimeout(async () => {
                try {
                    await bot.deleteMessage(chatId, sentMessage.message_id);
                    delete userStates[chatId].lastMeetupMessageId;
                } catch (error) {
                    console.error('Error deleting "no meetups" message:', error);
                }
            }, 5 * 60 * 1000);

            return;
        }

        const message = await formatMeetupsMessage(filteredEvents, timeFrame);

        let sentMessage;
        if (message.length > 4000) {
            await bot.deleteMessage(chatId, loadingMessage.message_id);
            const chunks = message.match(/.{1,4000}/gs);
            for (const chunk of chunks) {
                sentMessage = await bot.sendMessage(chatId, chunk, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                    disable_notification: true
                });
            }
        } else {
            sentMessage = await bot.editMessageText(message, {
                chat_id: chatId,
                message_id: loadingMessage.message_id,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                disable_notification: true,
            });
        }

        // Store the message ID
        userStates[chatId] = {
            ...userStates[chatId],
            lastMeetupMessageId: sentMessage.message_id
        };

        // Set a timer to delete the meetup message after 5 minutes
        setTimeout(async () => {
            try {
                await bot.deleteMessage(chatId, sentMessage.message_id);
                delete userStates[chatId].lastMeetupMessageId;
            } catch (error) {
                console.error('Error deleting meetup message:', error);
            }
        }, 5 * 60 * 1000);

    } catch (error) {
        console.error('Error in handleMeetupsFilter:', error);
        const errorMessage = await bot.sendMessage(chatId, 'Ein Fehler ist beim Mining der Meetups aufgetreten. Bitte versuche es später erneut.', {
            disable_notification: true
        });
        userStates[chatId] = {
            ...userStates[chatId],
            lastMeetupMessageId: errorMessage.message_id
        };

        // Set a timer to delete the error message after 5 minutes
        setTimeout(async () => {
            try {
                await bot.deleteMessage(chatId, errorMessage.message_id);
                delete userStates[chatId].lastMeetupMessageId;
            } catch (error) {
                console.error('Error deleting error message:', error);
            }
        }, 5 * 60 * 1000);
    }
};

const sortEventsByStartDate = (eventList) => {
    return eventList.map(calendar => ({
        ...calendar,
        events: calendar.events.sort((a, b) => {
            const aStart = parseInt(a.tags.find(t => t[0] === 'start')?. [1] || '0') * 1000;
            const bStart = parseInt(b.tags.find(t => t[0] === 'start')?. [1] || '0') * 1000;
            return aStart - bStart;
        })
    }));
};

const filterEventsByTimeFrame = (allEvents, timeFrame) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);
    const endOfMonth = new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000);
    endOfMonth.setHours(23, 59, 59, 999);

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
                    return eventDate >= today;
            }
        })
    }));
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

            for (const event of events) {
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
                    message += `👤 ${telegramUser}\n`;
                }

                if (location) {
                    const googleMapsLink = event.tags.find(t => t[0] === 'r' && t[1].includes('google.com/maps'))?. [1];
                    const osmLink = event.tags.find(t => t[0] === 'r' && t[1].includes('openstreetmap.org'))?. [1];
                    const appleMapsLink = event.tags.find(t => t[0] === 'r' && t[1].includes('maps.apple.com'))?. [1];
                    message += formatLocation(location, googleMapsLink, osmLink, appleMapsLink);
                }

                message += '\n';
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
    filterEventsByTimeFrame,
    formatMeetupsMessage,
    getHeaderMessage,
    sortEventsByStartDate,
};