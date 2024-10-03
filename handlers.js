import {
    fetchEventDirectly,
    publishEventToNostr
} from './nostrUtils.js';
import config from './config.js';
import {
    nip19,
    getPublicKey
} from 'nostr-tools';

import userStates from './userStates.js';

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
            const eventDetails = userStates[userChatId].pendingEvent;
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

        delete userStates[userChatId].pendingEvent;

        bot.answerCallbackQuery(callbackQuery.id, {
            text: isApproved ? 'Event genehmigt' : 'Event abgelehnt'
        });
        bot.deleteMessage(adminChatId, callbackQuery.message.message_id);
    }
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
    bot.sendMessage(userChatId, 'Ihre Löschungsanfrage wurde zur Genehmigung an die Administratoren gesendet. Wir werden Sie benachrichtigen, sobald eine Entscheidung getroffen wurde.', {
        disable_notification: true
    });
};

const handleDeletionInput = async (bot, msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!userStates[chatId] || userStates[chatId].step !== 'awaiting_event_id_for_deletion') {
        return; // Exit if we're not expecting a deletion input
    }

    if (text.toLowerCase() === '/cancel') {
        delete userStates[chatId];
        bot.sendMessage(chatId, "Löschungsvorgang abgebrochen.", {
            disable_notification: true
        });
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
        bot.sendMessage(chatId, "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut oder geben Sie /cancel ein, um abzubrechen.", {
            disable_notification: true
        });
        return;
    }

    if (!filter) {
        bot.sendMessage(chatId, "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut oder geben Sie /cancel ein, um abzubrechen.", {
            disable_notification: true
        });
        return;
    }

    console.log('Fetching event with filter:', filter);
    const event = await fetchEventDirectly(filter);
    if (!event) {
        bot.sendMessage(chatId, "Event nicht gefunden. Bitte überprüfen Sie die ID und versuchen Sie es erneut oder geben Sie /cancel ein, um abzubrechen.", {
            disable_notification: true
        });
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

export {
    handleDeletionInput,
    handleAdminApproval,
    handleDeletionConfirmation,
    sendDeletionRequestForApproval,
};