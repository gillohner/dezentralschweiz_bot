import {
    ethereumTriggerWords,
    ethereumResponses,
    shitcoinTriggerWords,
    shitCoinResponses
} from '../datasets/shitcoinLists.js';
import userStates from '../userStates.js';
import {
    handleDeletionInput
} from './meetupHandlers/meetupDeletionHandler.js';
import {
    handleEventCreationStep
} from './meetupHandlers/meetupSuggestionHandler.js';

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

        // Check for Twitter or X links and convert them
        const twitterRegex = /(https?:\/\/(www\.)?(twitter\.com|x\.com)\/[\w\d_/.-]+)(\?[^\s]*)?/gi;
        const convertedText = text.replace(twitterRegex, (match, p1) => {
            return p1.replace(/(twitter\.com|x\.com)/, 'nitter.poast.org');
        });

        if (convertedText !== text) {
            bot.sendMessage(msg.chat.id, convertedText, {
                disable_web_page_preview: true,
                disable_notification: true
            });
            return; // Exit the function to avoid further processing
        }

        // Check for Ethereum trigger words
        const isEthereum = ethereumTriggerWords.some(word => {
            const match = new RegExp(`\\b${word}\\b`).test(text);
            return match;
        });

        if (isEthereum) {
            const response = ethereumResponses[Math.floor(Math.random() * ethereumResponses.length)];
            bot.sendMessage(msg.chat.id, response, {
                parse_mode: 'HTML',
                disable_notification: true
            });
        }

        // Check for other shitcoin trigger words
        let matchedShitcoin = '';
        const isShitcoin = shitcoinTriggerWords.some(word => {
            const match = new RegExp(`\\b${word}\\b`).test(text);
            if (match) {
                matchedShitcoin = word;
            }
            return match;
        });

        if (isShitcoin) {
            const response = matchedShitcoin.toUpperCase() + "?!\n\n" + shitCoinResponses[Math.floor(Math.random() * shitCoinResponses.length)];
            bot.sendMessage(msg.chat.id, response, {
                parse_mode: 'HTML',
                disable_notification: true
            });
        }
    }
};

export {
    handleMessage
};