import {
    publishEventToNostr
} from '../../utils/nostrUtils.js'
import {
    nip19
} from 'nostr-tools'
import {
    fetchLocationData
} from '../../nominatim.js'
import config from '../../config.js';
import userStates from '../../userStates.js'

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
    const chatId = msg.chat.id;
    startEventSuggestion(bot, chatId, msg);
};

const handleAdminMeetupSuggestionApproval = async (bot, callbackQuery) => {
    const action = callbackQuery.data;
    const userChatId = action.split('_')[2];
    const isApproved = action.startsWith('approve_meetup_');
    console.log(`Event ${isApproved ? 'approved' : 'rejected'} for user ${userChatId}`);
    if (isApproved) {
        const eventDetails = userStates[userChatId].event;
        if (!eventDetails) {
            console.error('No pending event found for user', userChatId);
            bot.sendMessage(userChatId, 'Es gab einen Fehler bei der Verarbeitung deines Events. Bitte versuche es erneut.');
            return;
        }

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
    console.log(config.ADMIN_CHAT_ID, callbackQuery.message.message_id);
    bot.deleteMessage(config.ADMIN_CHAT_ID, callbackQuery.message.message_id);
}

const startEventSuggestion = (bot, chatId, msg) => {
    userStates[chatId] = {
        step: 'title',
        username: msg.from.username || '',
        firstName: msg.from.first_name || '',
        lastName: msg.from.last_name || '',
        event: {}
    };
    bot.sendMessage(chatId, 'Lass uns ein neues Event erstellen! Bitte gib den Titel des Events ein:\n\nDu kannst den Vorgang jederzeit mit /cancel abbrechen.', {
        disable_notification: true
    });
};

const handleEventCreationStep = async (bot, msg) => {
    const chatId = msg.chat.id;
    if (!userStates[chatId]) return;

    const {
        step
    } = userStates[chatId];
    const text = msg.text;

    if (text.toLowerCase() === '/cancel') {
        return handleCancellation(bot, chatId);
    }

    switch (step) {
        case 'title':
            const username = msg.chat.username;
            userStates[chatId].event.tg_user_link = `https://t.me/${username}`

            userStates[chatId].event.title = text;
            userStates[chatId].step = 'date';
            bot.sendMessage(chatId, 'Super! Nun gib bitte das Datum des Events ein (Format: YYYY-MM-DD):\n\nOder tippe /cancel um abzubrechen.', {
                disable_notification: true
            });
            break;
        case 'date':
            if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                bot.sendMessage(chatId, 'Ungültiges Datumsformat. Bitte verwende YYYY-MM-DD:\n\nOder tippe /cancel um abzubrechen.', {
                    disable_notification: true
                });
                return;
            }
            userStates[chatId].event.date = text;
            userStates[chatId].step = 'time';
            bot.sendMessage(chatId, 'Gib jetzt die Startzeit des Events ein (Format: HH:MM):\n\nOder tippe /cancel um abzubrechen.', {
                disable_notification: true
            });
            break;
        case 'time':
            if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(text)) {
                bot.sendMessage(chatId, 'Ungültiges Zeitformat. Bitte verwende HH:MM:\n\nOder tippe /cancel um abzubrechen.', {
                    disable_notification: true
                });
                return;
            }
            userStates[chatId].event.time = text;
            userStates[chatId].step = 'location';
            bot.sendMessage(chatId, 'Wo findet das Event statt?\n\nOder tippe /cancel um abzubrechen.', {
                disable_notification: true
            });
            break;
        case 'location':
            const locationData = await fetchLocationData(text);
            if (locationData) {
                userStates[chatId].tempLocation = {
                    input: text,
                    data: locationData
                };
                const confirmationMessage = `Ich habe folgende Location gefunden:\n${locationData.display_name}\n\nIst das korrekt?`;
                const keyboard = {
                    inline_keyboard: [
                        [{
                            text: 'Ja, das ist korrekt',
                            callback_data: 'confirm_location'
                        }],
                        [{
                            text: 'Nein, erneut eingeben',
                            callback_data: 'retry_location'
                        }]
                    ]
                };
                bot.sendMessage(chatId, confirmationMessage, {
                    reply_markup: JSON.stringify(keyboard),
                    disable_notification: true
                });
            } else {
                bot.sendMessage(chatId, 'Ich konnte keine passende Location finden. Bitte versuche es erneut oder gib eine genauere Beschreibung ein:\n\nOder tippe /cancel um abzubrechen.', {
                    disable_notification: true
                });
            }
            break;
        case 'description':
            userStates[chatId].event.description = text;
            showOptionalFieldsMenu(bot, chatId);
            break;
        case 'end_date':
            if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                bot.sendMessage(chatId, 'Ungültiges Datumsformat. Bitte verwende YYYY-MM-DD:\n\nOder tippe /cancel um abzubrechen.', {
                    disable_notification: true
                });
                return;
            }
            userStates[chatId].end_date = text;
            userStates[chatId].step = 'end_time';
            bot.sendMessage(chatId, 'Gib jetzt die Endzeit des Events ein (Format: HH:MM):\n\nOder tippe /cancel um abzubrechen.', {
                disable_notification: true
            });
            break;
        case 'end_time':
            if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(text)) {
                bot.sendMessage(chatId, 'Ungültiges Zeitformat. Bitte verwende HH:MM:\n\nOder tippe /cancel um abzubrechen.', {
                    disable_notification: true
                });
                return;
            }
            userStates[chatId].end_time = text;
            showOptionalFieldsMenu(bot, chatId);
            break;
        case 'image':
            userStates[chatId].image = text;
            showOptionalFieldsMenu(bot, chatId);
            break;
    }
};

const handleCancellation = (bot, chatId) => {
    delete userStates[chatId];
    bot.sendMessage(chatId, 'Meetup-Erstellung abgebrochen. Du kannst jederzeit mit /meetup_vorschlagen neu beginnen.', {
        disable_notification: true
    });
};

const showOptionalFieldsMenu = (bot, chatId) => {
    const keyboard = {
        inline_keyboard: [
            [{
                text: 'Enddatum hinzufügen',
                callback_data: 'add_end_date'
            }],
            [{
                text: 'Bild-URL hinzufügen',
                callback_data: 'add_image'
            }],
            [{
                text: 'Zur Genehmigung senden',
                callback_data: 'send_for_approval'
            }],
            [{
                text: 'Abbrechen',
                callback_data: 'cancel_creation'
            }]
        ]
    };
    bot.sendMessage(chatId, 'Möchtest du optionale Felder hinzufügen, das Event zur Genehmigung senden oder abbrechen?', {
        reply_markup: JSON.stringify(keyboard),
        disable_notification: true
    });
};

const handleOptionalField = (bot, chatId, field) => {
    if (!userStates[chatId]) {
        userStates[chatId] = {}; // Initialize the state if it doesn't exist
    }
    userStates[chatId].step = field;
    switch (field) {
        case 'end_date':
            bot.sendMessage(chatId, 'Bitte gib das Enddatum des Events ein (Format: YYYY-MM-DD):', {
                disable_notification: true
            });
            break;
        case 'image':
            bot.sendMessage(chatId, 'Bitte gib die URL des Eventbildes ein:', {
                disable_notification: true
            });
            break;
        case 'about':
            bot.sendMessage(chatId, 'Bitte gib einen kurzen "Über"-Text für das Event ein:', {
                disable_notification: true
            });
            break;
    }
};

const sendEventForApproval = (bot, callbackQuery, userChatId) => {
    const msg = callbackQuery.message;
    const eventDetails = userStates[userChatId].event;

    if (!eventDetails) {
        bot.sendMessage(userChatId, "Es tut mir leid, aber ich habe keine Informationen über dein Event. Bitte starte den Prozess erneut mit /meetup_vorschlagen.", {
            disable_notification: true
        });
    }

    const adminChatId = config.ADMIN_CHAT_ID;
    const userInfo = userStates[userChatId];
    let userIdentifier = userInfo.username ? `@${userInfo.username}` : `${userInfo.firstName} ${userInfo.lastName}`.trim();
    if (!userIdentifier) {
        userIdentifier = 'Unbekannter Benutzer';
    }

    let message = `
Neuer Event-Vorschlag von ${userIdentifier}:
Titel: ${eventDetails.title}
Datum: ${eventDetails.date}
Zeit: ${eventDetails.time}
Ort: ${eventDetails.location}
Beschreibung: ${eventDetails.description}
`;

    if (eventDetails.end_date) message += `Enddatum: ${eventDetails.end_date}\n`;
    if (eventDetails.end_time) message += `Endzeit: ${eventDetails.end_time}\n`;
    if (eventDetails.image) message += `Bild-URL: ${eventDetails.image}\n`;

    message += '\nMöchtest du dieses Event genehmigen?';

    const keyboard = {
        inline_keyboard: [
            [{
                    text: 'Genehmigen',
                    callback_data: `approve_meetup_${userChatId}`
                },
                {
                    text: 'Ablehnen',
                    callback_data: `reject_meetup_${userChatId}`
                }
            ]
        ]
    };

    delete userStates[userChatId].step;

    bot.sendMessage(adminChatId, message, {
        reply_markup: JSON.stringify(keyboard)
    });
    bot.sendMessage(userChatId, 'Dein Event-Vorschlag wurde zur Genehmigung eingereicht. Wir werden dich benachrichtigen, sobald er überprüft wurde.', {
        disable_notification: true
    });
};

const handleConfirmLocation = (bot, callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    const locationData = userStates[chatId].tempLocation.data;
    const lat = locationData.lat;
    const lon = locationData.lon;
    const locationName = locationData.name;
    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${locationName}`;
    const osmLink = `https://www.openstreetmap.org/${locationData.osm_type}/${locationData.osm_id}`;
    const appleMapsLink = `http://maps.apple.com/?q=${locationName}&ll=${lat},${lon}`;

    userStates[chatId].event.osm_link = osmLink;
    userStates[chatId].event.gmaps_link = googleMapsLink;
    userStates[chatId].event.applemaps_link = appleMapsLink;
    userStates[chatId].event.location = locationData.display_name;
    userStates[chatId].step = 'description';
    bot.sendMessage(chatId, 'Großartig! Zum Schluss, gib bitte eine kurze Beschreibung des Events ein:\n\nOder tippe /cancel um abzubrechen.', {
        disable_notification: true
    });
}

const handleRetryLocation = (bot, callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    userStates[chatId].step = 'location';
    bot.sendMessage(chatId, 'Okay, bitte gib die Location erneut ein:\n\nOder tippe /cancel um abzubrechen.', {
        disable_notification: true
    });
}

export {
    handleMeetupSuggestion,
    handleAdminMeetupSuggestionApproval,
    startEventSuggestion,
    handleEventCreationStep,
    handleOptionalField,
    sendEventForApproval,
    handleCancellation,
    handleConfirmLocation,
    handleRetryLocation,
};