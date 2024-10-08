// Datasets
import communityLinks from '../datasets/communityLinks.js';

// State
import userStates from '../userStates.js';

// Helpers
import {
    deleteMessageWithTimeout,
    deleteMessage,
    sendAndStoreMessage
} from '../utils/helpers.js'

const handleLinks = async (bot, msg, communityLinks) => {
    const chatId = msg.chat.id;
    const keyboard = {
        inline_keyboard: [
            ...Object.keys(communityLinks).map(category => [{
                text: category,
                callback_data: `links_${category}`
            }]),
            [{
                text: 'Abbrechen',
                callback_data: 'links_cancel'
            }]
        ]
    };

    // Delete the user's /links command message
    if (msg.message_id) {
        deleteMessage(bot, chatId, msg.message_id);
    };

    const sentMessage = await sendAndStoreMessage(
        bot,
        chatId,
        'Wähle eine Kategorie:', {
            reply_markup: JSON.stringify(keyboard),
            disable_notification: true
        },
        'lastLinksMessageId'
    );

    deleteMessageWithTimeout(bot, chatId, sentMessage.message_id, 10 * 60 * 1000);
};

const handleLinksCallback = async (bot, callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    if (action === 'links_cancel') {
        // Handle cancel action
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Aktion abgebrochen'
        });
        try {
            // Delete the selection message
            deleteMessage(bot, chatId, msg.message_id);
            delete userStates[chatId].lastLinksMessageId;

            // Delete the last category message if it exists
            if (userStates[chatId]?.lastLinksCategoryMessageId) {
                deleteMessage(bot, chatId, userStates[chatId].lastLinksCategoryMessageId);
                delete userStates[chatId].lastLinksCategoryMessageId;
            }
        } catch (error) {
            console.error('Error deleting messages:', error);
        }
    } else {
        const category = action.split('_')[1];
        const links = communityLinks[category];
        let message = `<b>${category}:\n\n</b>`;
        links.forEach(link => {
            message += `${link.name}\n${link.url}\n\n`;
        });

        await bot.answerCallbackQuery(callbackQuery.id);

        // Delete the previous category message if it exists
        if (userStates[chatId]?.lastLinksCategoryMessageId) {
            deleteMessage(bot, chatId, userStates[chatId].lastLinksCategoryMessageId);
        }

        const sentMessage = await sendAndStoreMessage(
            bot,
            chatId,
            message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                disable_notification: true
            },
            'lastLinksCategoryMessageId'
        );

        deleteMessageWithTimeout(bot, chatId, sentMessage.message_id, 5 * 60 * 1000);
    }
}

export {
    handleLinks,
    handleLinksCallback
};