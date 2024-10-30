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
        const text = msg.text || "";

        // Check for Twitter or X links and convert them
        const twitterRegex = /(?:https?:\/\/)?(?:www\.)?(twitter\.com|x\.com)\/[\w\d_/.-]+(?:\?[^\s]*)?/gi;
        let match;
        while ((match = twitterRegex.exec(text)) !== null) {
            const originalUrl = match[0];
            const convertedUrl = originalUrl.replace(/^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)/, 'https://nitter.poast.org');

            bot.sendMessage(msg.chat.id, convertedUrl.split('?')[0], {
                disable_web_page_preview: true,
                disable_notification: true
            });
        }

        // Check for any URL and sanitize
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        let urlMatch;
        while ((urlMatch = urlRegex.exec(text)) !== null) {
            const originalUrl = urlMatch[0];
            const sanitizedUrl = originalUrl.split('?')[0];

            if (sanitizedUrl !== originalUrl) {
                bot.sendMessage(msg.chat.id, sanitizedUrl, {
                    disable_web_page_preview: true,
                    disable_notification: true
                });
            }
        }

        const lowerText = text.toLowerCase();

        // Check for Ethereum trigger words
        const isEthereum = ethereumTriggerWords.some(word => {
            return new RegExp(`\\b${word}\\b`).test(lowerText);
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
            const match = new RegExp(`\\b${word}\\b`).test(lowerText);
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
