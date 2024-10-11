// scheduledTasks.js
import schedule from 'node-schedule';
import { fetchMeetupsLogic } from './handlers/meetupHandlers/meetupDisplayingHandler.js';
import { deleteMessage, sendAndStoreMessage, editAndStoreMessage } from './utils/helpers.js';
import config from './bot/config.js';

const scheduleWeeklyMeetupPost = (bot) => {
    postWeeklyMeetups(bot)
    schedule.scheduleJob('0 7 * * 1', async () => {
        console.log('Running scheduled weekly meetup post');
        await postWeeklyMeetups(bot);
    });
};

const postWeeklyMeetups = async (bot) => {
    let chatId = config.MEETUP_CHAT_ID;
    if (!chatId) {
        console.error('MEETUP_CHAT_ID is not set in the environment variables');
        return;
    }

    try {
        const chatInfo = await bot.getChat(chatId);
        let pinnedMessageId = chatInfo.pinned_message ? chatInfo.pinned_message.message_id : null;

        if (pinnedMessageId) {
            await bot.unpinChatMessage(chatId);
            await deleteMessage(bot, chatId, pinnedMessageId);
        }

        const meetupMessage = await fetchMeetupsLogic('dieseWoche');

        if (meetupMessage) {
            let sentMessage = await sendAndStoreMessage(bot, chatId, meetupMessage, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }, 'pinnedMeetupMessageId');

            await bot.pinChatMessage(chatId, sentMessage.message_id);
        } 
    } catch (error) {
        console.error('Error posting weekly meetups:', error);
    }
};


export { scheduleWeeklyMeetupPost, postWeeklyMeetups };
