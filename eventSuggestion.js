const userStates = {};
const {
    publishEventToNostr
} = require('./nostrUtils');

function startEventSuggestion(bot, chatId, msg) {
    userStates[chatId] = {
        step: 'title',
        username: msg.from.username || '',
        firstName: msg.from.first_name || '',
        lastName: msg.from.last_name || ''
    };
    bot.sendMessage(chatId, 'Lass uns ein neues Event erstellen! Bitte gib den Titel des Events ein:');
}

function handleEventCreationStep(bot, msg) {
    const chatId = msg.chat.id;
    if (!userStates[chatId]) return;

    const {
        step
    } = userStates[chatId];
    const text = msg.text;

    switch (step) {
        case 'title':
            userStates[chatId].title = text;
            userStates[chatId].step = 'date';
            bot.sendMessage(chatId, 'Super! Nun gib bitte das Datum des Events ein (Format: YYYY-MM-DD):');
            break;
        case 'date':
            userStates[chatId].date = text;
            userStates[chatId].step = 'time';
            bot.sendMessage(chatId, 'Gib jetzt die Uhrzeit des Events ein (Format: HH:MM):');
            break;
        case 'time':
            userStates[chatId].time = text;
            userStates[chatId].step = 'location';
            bot.sendMessage(chatId, 'Wo findet das Event statt?');
            break;
        case 'location':
            userStates[chatId].location = text;
            userStates[chatId].step = 'description';
            bot.sendMessage(chatId, 'Zum Schluss, gib bitte eine kurze Beschreibung des Events ein:');
            break;
        case 'description':
            userStates[chatId].description = text;
            showOptionalFieldsMenu(bot, chatId);
            break;
        case 'end_date':
            userStates[chatId].end_date = text;
            showOptionalFieldsMenu(bot, chatId);
            break;
        case 'image':
            userStates[chatId].image = text;
            showOptionalFieldsMenu(bot, chatId);
            break;
        case 'about':
            userStates[chatId].about = text;
            showOptionalFieldsMenu(bot, chatId);
            break;
        case 'awaiting_event_id_for_deletion':
            handleDeletionRequest(bot, chatId, text);
            break;
    }
}

function handleDeletionRequest(bot, chatId, eventIdentifier) {
    // Here you would typically validate the event identifier and fetch event details
    // For this example, we'll assume it's valid and send it for admin approval
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const message = `
  Löschungsanfrage für Event:
  Event-ID/Link: ${eventIdentifier}
  
  Möchten Sie dieses Event löschen?
    `;

    const keyboard = {
        inline_keyboard: [
            [{
                    text: 'Löschen',
                    callback_data: `delete_${eventIdentifier}`
                },
                {
                    text: 'Ablehnen',
                    callback_data: `reject_delete_${eventIdentifier}`
                }
            ]
        ]
    };

    bot.sendMessage(adminChatId, message, {
        reply_markup: JSON.stringify(keyboard)
    });
    bot.sendMessage(chatId, 'Deine Löschungsanfrage wurde zur Überprüfung an die Administratoren gesendet. Wir werden dich benachrichtigen, sobald eine Entscheidung getroffen wurde.');
    delete userStates[chatId];
}

function showOptionalFieldsMenu(bot, chatId) {
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
                text: 'Über-Text hinzufügen',
                callback_data: 'add_about'
            }],
            [{
                text: 'Zur Genehmigung senden',
                callback_data: 'send_for_approval'
            }]
        ]
    };
    bot.sendMessage(chatId, 'Möchtest du optionale Felder hinzufügen oder das Event zur Genehmigung senden?', {
        reply_markup: JSON.stringify(keyboard)
    });
}

function handleOptionalField(bot, chatId, field) {
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
}

function sendEventForApproval(bot, userChatId, eventDetails) {
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
    if (eventDetails.image) message += `Bild-URL: ${eventDetails.image}\n`;
    if (eventDetails.about) message += `Über: ${eventDetails.about}\n`;

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
}

function extractEventDetails(messageText) {
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
}

module.exports = {
    startEventSuggestion,
    handleEventCreationStep,
    handleOptionalField,
    sendEventForApproval,
    userStates
};
