const userStates = {};
const {
    publishEventToNostr
} = require('./nostrUtils');

function startEventSuggestion(bot, chatId) {
    userStates[chatId] = {
        step: 'title'
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
    }
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
    let message = `
Neuer Event-Vorschlag:
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

async function handleAdminApproval(bot, callbackQuery) {
    const action = callbackQuery.data;
    const adminChatId = callbackQuery.message.chat.id;
    const {
        nip19
    } = require('nostr-tools');

    if (action.startsWith('approve_') || action.startsWith('reject_')) {
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


function extractEventDetails(messageText) {
    const lines = messageText.split('\n');
    const details = {
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
    handleAdminApproval,
    handleOptionalField,
    sendEventForApproval,
    userStates
};