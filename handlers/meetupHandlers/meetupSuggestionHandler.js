import {
    startEventSuggestion
} from '../../eventSuggestion.js';
import userStates from '../../userStates.js'
import {
    publishEventToNostr
} from '../../nostrUtils.js'
import {
    nip19
} from 'nostr-tools'
import config from '../../config.js';

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

export {
    handleMeetupSuggestion,
    handleAdminMeetupSuggestionApproval
};