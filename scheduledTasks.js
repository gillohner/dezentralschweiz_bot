// scheduledTasks.js
import schedule from 'node-schedule';
import { handleMeetupsFilter } from './handlers/meetupHandlers/meetupDisplayingHandler.js';
import { deleteMessage, sendAndStoreMessage, editAndStoreMessage } from './utils/helpers.js';
import config from './bot/config.js';
import userStates from './userStates.js';

const scheduleWeeklyMeetupPost = (bot) => {
    // schedule.scheduleJob('0 7 * * 1', async () => {
    schedule.scheduleJob('* * * * *', async () => {
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
        // Check for a pinned message and unpin it
        const chatInfo = await bot.getChat(chatId);
        let pinnedMessageId = chatInfo.pinned_message ? chatInfo.pinned_message.message_id : null;

        if (pinnedMessageId) {
            await bot.unpinChatMessage(chatId);
            await deleteMessage(bot, chatId, pinnedMessageId);
        }

        // Generate the meetup message for the week
        const msg = { chat: { id: chatId } };
        const meetupMessage = await handleMeetupsFilter(bot, msg, 'week', "pinnedMeetupMessageId");

        if (meetupMessage) {
            let sentMessage;
            if (userStates[chatId] && userStates[chatId].pinnedMeetupMessageId) {
                // Edit the existing message
                sentMessage = await editAndStoreMessage(bot, chatId, meetupMessage, {
                    chat_id: chatId,
                    message_id: userStates[chatId].pinnedMeetupMessageId,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                }, 'pinnedMeetupMessageId');
            } else {
                // Send a new message if no previous pinned message
                sentMessage = await sendAndStoreMessage(bot, chatId, meetupMessage, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                }, 'pinnedMeetupMessageId');
            }

            // Pin the new or edited message
            await bot.pinChatMessage(chatId, sentMessage.message_id);
        }
    } catch (error) {
        console.error('Error posting weekly meetups:', error);
    }
};

export { scheduleWeeklyMeetupPost, postWeeklyMeetups };
