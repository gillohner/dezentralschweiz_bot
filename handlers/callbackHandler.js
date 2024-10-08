import {
    handleLinksCallback
} from './linkHandler.js'
import {
    handleMeetupsFilter
} from './meetupHandlers/meetupDisplayingHandler.js'
import {
    handleAdminApproval
} from './adminApprovalHandler.js'
import {
    sendEventForApproval, 
    handleCancellation,
    handleConfirmLocation,
    handleRetryLocation,
    handleOptionalField,
} from './meetupHandlers/meetupSuggestionHandler.js'
import {
    deleteMessage
} from '../utils/helpers.js'

const handleCallbackQuery = async (bot, callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    if (action.startsWith('links_')) {
        handleLinksCallback(bot, callbackQuery);
    } else if (action.startsWith('meetups_')) {
        const timeFrame = action.split('_')[1];
        await handleMeetupsFilter(bot, msg, timeFrame);
    } else if (action.startsWith('approve_') || action.startsWith('reject_')) {
        await handleAdminApproval(bot, callbackQuery, action);
    } else if (action === 'add_end_date') {
        handleOptionalField(bot, chatId, 'end_date');
    } else if (action === 'add_image') {
        handleOptionalField(bot, chatId, 'image');
    } else if (action === 'add_about') {
        handleOptionalField(bot, chatId, 'about');
    } else if (action === 'send_for_approval') {
        sendEventForApproval(bot, callbackQuery, chatId);
    } else if (action === 'cancel_creation') {
        handleCancellation(bot, chatId);
        bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Meetup-Erstellung abgebrochen'
        });
        deleteMessage(bot, chatId, msg.message_id);
    } else if (action === 'confirm_location') {
        handleConfirmLocation(bot, callbackQuery);
    } else if (action === 'retry_location') {
        handleRetryLocation(bot, callbackQuery);
    }
};

export {
    handleCallbackQuery
};