import {
    publishEventToNostr
} from './nostrUtils.js';

const userStates = {};

const startEventSuggestion = (bot, chatId, msg) => {
    userStates[chatId] = {
        step: 'title',
        username: msg.from.username || '',
        firstName: msg.from.first_name || '',
        lastName: msg.from.last_name || ''
    };
    bot.sendMessage(chatId, 'Lass uns ein neues Event erstellen! Bitte gib den Titel des Events ein:\n\nDu kannst den Vorgang jederzeit mit /cancel abbrechen.');
};

const handleEventCreationStep = (bot, msg) => {
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
            userStates[chatId].title = text;
            userStates[chatId].step = 'date';
            bot.sendMessage(chatId, 'Super! Nun gib bitte das Datum des Events ein (Format: YYYY-MM-DD):\n\nOder tippe /cancel um abzubrechen.');
            break;
        case 'date':
            if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                bot.sendMessage(chatId, 'Ungültiges Datumsformat. Bitte verwende YYYY-MM-DD:\n\nOder tippe /cancel um abzubrechen.');
                return;
            }
            userStates[chatId].date = text;
            userStates[chatId].step = 'time';
            bot.sendMessage(chatId, 'Gib jetzt die Startzeit des Events ein (Format: HH:MM):\n\nOder tippe /cancel um abzubrechen.');
            break;
        case 'time':
            if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(text)) {
                bot.sendMessage(chatId, 'Ungültiges Zeitformat. Bitte verwende HH:MM:\n\nOder tippe /cancel um abzubrechen.');
                return;
            }
            userStates[chatId].time = text;
            userStates[chatId].step = 'location';
            bot.sendMessage(chatId, 'Wo findet das Event statt?\n\nOder tippe /cancel um abzubrechen.');
            break;
        case 'location':
            userStates[chatId].location = text;
            userStates[chatId].step = 'description';
            bot.sendMessage(chatId, 'Zum Schluss, gib bitte eine kurze Beschreibung des Events ein:\n\nOder tippe /cancel um abzubrechen.');
            break;
        case 'description':
            userStates[chatId].description = text;
            showOptionalFieldsMenu(bot, chatId);
            break;
        case 'end_date':
            if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                bot.sendMessage(chatId, 'Ungültiges Datumsformat. Bitte verwende YYYY-MM-DD:\n\nOder tippe /cancel um abzubrechen.');
                return;
            }
            userStates[chatId].end_date = text;
            userStates[chatId].step = 'end_time';
            bot.sendMessage(chatId, 'Gib jetzt die Endzeit des Events ein (Format: HH:MM):\n\nOder tippe /cancel um abzubrechen.');
            break;
        case 'end_time':
            if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(text)) {
                bot.sendMessage(chatId, 'Ungültiges Zeitformat. Bitte verwende HH:MM:\n\nOder tippe /cancel um abzubrechen.');
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
    bot.sendMessage(chatId, 'Meetup-Erstellung abgebrochen. Du kannst jederzeit mit /meetup_vorschlagen neu beginnen.');
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
        reply_markup: JSON.stringify(keyboard)
    });
};

const handleOptionalField = (bot, chatId, field) => {
    if (!userStates[chatId]) {
        userStates[chatId] = {}; // Initialize the state if it doesn't exist
    }
    userStates[chatId].step = field;
    switch (field) {
        case 'end_date':
            bot.sendMessage(chatId, 'Bitte gib das Enddatum des Events ein (Format: YYYY-MM-DD):');
            break;
        case 'image':
            bot.sendMessage(chatId, 'Bitte gib die URL des Eventbildes ein:');
            break;
        case 'about':
            bot.sendMessage(chatId, 'Bitte gib einen kurzen "Über"-Text für das Event ein:');
            break;
    }
};

const sendEventForApproval = (bot, userChatId, eventDetails) => {
    const adminChatId = process.env.ADMIN_CHAT_ID;
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
                    callback_data: `approve_${userChatId}`
                },
                {
                    text: 'Ablehnen',
                    callback_data: `reject_${userChatId}`
                }
            ]
        ]
    };

    bot.sendMessage(adminChatId, message, {
        reply_markup: JSON.stringify(keyboard)
    });
    bot.sendMessage(userChatId, 'Dein Event-Vorschlag wurde zur Genehmigung eingereicht. Wir werden dich benachrichtigen, sobald er überprüft wurde.');
};

const extractEventDetails = (messageText) => {
    const lines = messageText.split('\n');
    const details = {
        creator: lines[0].split('von ')[1].split(' (')[0],
        title: lines[1].split(': ')[1],
        date: lines[2].split(': ')[1],
        time: lines[3].split(': ')[1],
        location: lines[4].split(': ')[1],
        description: lines[5].split(': ')[1],
    };

    lines.slice(6).forEach(line => {
        if (line.startsWith('Enddatum: ')) details.end_date = line.split(': ')[1];
        if (line.startsWith('Bild-URL: ')) details.image = line.split(': ')[1];
        if (line.startsWith('Über: ')) details.about = line.split(': ')[1];
    });

    return details;
};

export {
    startEventSuggestion,
    handleEventCreationStep,
    handleOptionalField,
    sendEventForApproval,
    extractEventDetails,
    handleCancellation,
    userStates
};