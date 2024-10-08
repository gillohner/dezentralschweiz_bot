// Datasets
import communityLinks from '../datasets/communityLinks.js';

// State
import userStates from '../userStates.js';

// Helpers
import {
    deleteMessageWithTimeout
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
    try {
        await bot.deleteMessage(chatId, msg.message_id);
    } catch (error) {
        console.error('Error deleting user command message:', error);
    }

    const sentMessage = await bot.sendMessage(chatId, 'Wähle eine Kategorie:', {
        reply_markup: JSON.stringify(keyboard),
        disable_notification: true
    });

    // Store the message ID for future deletion
    userStates[chatId] = {
        ...userStates[chatId],
        lastLinksMessageId: sentMessage.message_id
    };

    deleteMessageWithTimeout(bot, chatId, sentMessage.message_id)    
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
            await bot.deleteMessage(chatId, msg.message_id);
            delete userStates[chatId].lastLinksMessageId;

            // Delete the last category message if it exists
            if (userStates[chatId]?.lastLinksCategoryMessageId) {
                await bot.deleteMessage(chatId, userStates[chatId].lastLinksCategoryMessageId);
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
            try {
                await bot.deleteMessage(chatId, userStates[chatId].lastLinksCategoryMessageId);
            } catch (error) {
                console.error('Error deleting previous category message:', error);
            }
        }

        const sentMessage = await bot.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            disable_notification: true
        });

        // Store the new category message ID
        userStates[chatId] = {
            ...userStates[chatId],
            lastLinksCategoryMessageId: sentMessage.message_id
        };

        deleteMessageWithTimeout(bot, chatId, sentMessage.message_id)    
    }
}

export {
    handleLinks,
    handleLinksCallback
};