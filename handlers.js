import {
    fetchCalendarEvents,
    fetchEventDirectly,
    publishEventToNostr
} from './nostrUtils.js';
import config from './config.js';
import {
    nip19,
    getPublicKey
} from 'nostr-tools';
import {
    startEventSuggestion,
    handleEventCreationStep,
    handleOptionalField,
    sendEventForApproval,
    handleCancellation,
} from './eventSuggestion.js';
import communityLinks from './communityLinks.js';
import {
    ethereumTriggerWords,
    ethereumResponses,
    shitcoinTriggerWords,
    shitCoinResponses
} from './shitcoinLists.js';
import telegramGroups from './telegramGroups.js';

import userStates from './userStates.js';

const handleStart = async (bot, msg) => {
    const chatId = msg.chat.id;
    const message = `
<b>Willkommen beim Dezentralschweiz Bot! 🇨🇭</b>

Hier sind die wichtigsten Befehle:

/meetups - Zeige bevorstehende Meetups
<i>Erhalte eine Liste aller anstehenden Veranstaltungen in der Dezentralschweiz Community.</i>

/links - Zeige Community-Links
<i>Entdecke wichtige Links und Ressourcen unserer Community.</i>

/meetup_vorschlagen - Schlage ein neues Event vor
<i>Möchtest du ein Meetup organisieren? Nutze diesen Befehl, um ein Nostr-Event vorzuschlagen. (DM only)</i>

/meetup_loeschen - Schlage ein neues Event vor
<i>Hast du beim erstellen eines Meetups einen Fehler gemacht oder das Meetup wurde abgesagt? Nutze diesen Befehl um ein Nostr Delete-Event abzusenden. (DM only)</i>

Wir freuen uns, dass du Teil unserer Community bist! Bei Fragen stehen wir dir gerne zur Verfügung.

<blockquote>Made with ❤️ by @g1ll0hn3r</blockquote>
`;
    await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_notification: true
    });
};

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



const handleDeleteEventRequest = (bot, msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = {
        step: 'awaiting_event_id_for_deletion'
    };
    bot.sendMessage(chatId, "Bitte geben Sie die Event-ID oder NADDR des zu löschenden Events ein, oder /cancel um abzubrechen:", {
        disable_notification: true
    });
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

const handleMessage = (bot, msg) => {
    if (msg.chat.type === 'private') {
        const chatId = msg.chat.id;
        if (userStates[chatId]?.step === 'awaiting_event_id_for_deletion') {
            handleDeletionInput(bot, msg);
        } else {
            handleEventCreationStep(bot, msg);
        }
    } else {
        // Check for trigger words in group chats
        const text = msg.text ? msg.text.toLowerCase() : "";

        let matchedEthereum = '';
        const isEthereum = ethereumTriggerWords.some(word => {
            const match = new RegExp(`\\b${word}\\b`).test(text);
            if (match) {
                matchedEthereum = word;
            }
            return match;
        });

        // Check for Ethereum trigger words
        if (isEthereum) {
            const response = ethereumResponses[Math.floor(Math.random() * ethereumResponses.length)];
            bot.sendMessage(msg.chat.id, response, {
                parse_mode: 'HTML',
                disable_notification: true
            });
        }

        let matchedShitcoin = '';
        const isShitcoin = shitcoinTriggerWords.some(word => {
            const match = new RegExp(`\\b${word}\\b`).test(text);
            if (match) {
                matchedShitcoin = word;
            }
            return match;
        });

        // Check for other shitcoin trigger words
        if (isShitcoin) {
            const response = matchedShitcoin.toUpperCase() + "?!\n\n" + shitCoinResponses[Math.floor(Math.random() * shitCoinResponses.length)];
            bot.sendMessage(msg.chat.id, response, {
                parse_mode: 'HTML',
                disable_notification: true
            });
        }
    }
};

const handleMeetupDeletion = (bot, msg) => {
    if (msg.chat.type !== 'private') {
        bot.sendMessage(msg.chat.id, 'Dieser Befehl funktioniert nur in privaten Nachrichten. Bitte sende mir eine direkte Nachricht, um eine Eventlöschung anzufordern.', {
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
    handleDeleteEventRequest(bot, msg);
};

const handleGetGroupId = async (bot, msg) => {
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
        const groupId = msg.chat.id;
        const groupName = msg.chat.title;
        const message = `Group ID: ${groupId}\nGroup Name: ${groupName}`;

        // Send to admin chat
        await bot.sendMessage(config.ADMIN_CHAT_ID, message, {
            disable_notification: true
        });

        // Optionally, delete the command message to keep it hidden
        await bot.deleteMessage(msg.chat.id, msg.message_id);
    }
};

const handleNewMember = async (bot, msg) => {
    const chatId = msg.chat.id;
    const newMember = msg.new_chat_member;
    const groupInfo = telegramGroups[chatId.toString()];

    if (groupInfo) {
        const username = newMember.username ? `@${newMember.username}` : newMember.first_name;
        const welcomeMessage = `Hallo ${username}!\n\n${groupInfo.welcomeMessage}`;
        await bot.sendMessage(chatId, welcomeMessage, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }
};

export {
    handleStart,
    handleDeleteEventRequest,
    handleDeletionInput,
    handleAdminApproval,
    handleDeletionConfirmation,
    sendDeletionRequestForApproval,
    handleMessage,
    handleMeetupDeletion,
    handleGetGroupId,
    handleNewMember
};