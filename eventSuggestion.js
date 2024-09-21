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
            sendEventForApproval(bot, chatId, userStates[chatId]);
            delete userStates[chatId];
            break;
    }
}

function sendEventForApproval(bot, userChatId, eventDetails) {
    const adminChatId = process.env.ADMIN_CHAT_ID;
    const message = `
Neuer Event-Vorschlag:
Titel: ${eventDetails.title}
Datum: ${eventDetails.date}
Zeit: ${eventDetails.time}
Ort: ${eventDetails.location}
Beschreibung: ${eventDetails.description}

Möchtest du dieses Event genehmigen?
  `;

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

    console.log('Admin approval action:', action);

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
                bot.sendMessage(userChatId, 'Dein Event wurde genehmigt und veröffentlicht!');
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
    // Extract event details from the admin approval message
    // This is a simple implementation and might need to be adjusted based on the exact format of your message
    const lines = messageText.split('\n');
    return {
        title: lines[1].split(': ')[1],
        date: lines[2].split(': ')[1],
        time: lines[3].split(': ')[1],
        location: lines[4].split(': ')[1],
        description: lines[5].split(': ')[1],
    };
}

module.exports = {
    startEventSuggestion,
    handleEventCreationStep,
    handleAdminApproval
};