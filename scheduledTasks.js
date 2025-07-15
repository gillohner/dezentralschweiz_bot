// scheduledTasks.js
import schedule from 'node-schedule';
import { fetchMeetupsLogic } from './handlers/meetupHandlers/meetupDisplayingHandler.js';
import { deleteMessage, sendAndStoreMessage, editAndStoreMessage } from './utils/helpers.js';
import config from './bot/config.js';

const scheduleWeeklyMeetupPost = (bot) => {
    // Check and update on startup
    checkAndUpdateOnStartup(bot);
    
    // Schedule weekly post on Mondays at 7 AM
    schedule.scheduleJob('0 7 * * 1', async () => {
        console.log('Running scheduled weekly meetup post');
        await postWeeklyMeetups(bot, true); // Force update on scheduled run
    });
};

const checkAndUpdateOnStartup = async (bot) => {
    console.log('Checking pinned message on startup...');
    try {
        await postWeeklyMeetups(bot, false); // Don't force, let it check age
    } catch (error) {
        console.error('Error checking pinned message on startup:', error);
    }
};

const postWeeklyMeetups = async (bot, forceUpdate = false) => {
    let chatId = config.MEETUP_CHAT_ID;
    if (!chatId) {
        console.error('MEETUP_CHAT_ID is not set in the environment variables');
        return;
    }

    try {
        const chatInfo = await bot.getChat(chatId);
        let pinnedMessage = chatInfo.pinned_message;
        
        // Check if we should unpin the current message
        let shouldUnpin = false;
        
        if (pinnedMessage) {
            // Check if the pinned message is from our bot
            const botInfo = await bot.getMe();
            const isBotMessage = pinnedMessage.from && pinnedMessage.from.id === botInfo.id;
            
            if (isBotMessage) {
                if (forceUpdate) {
                    // Force update requested
                    shouldUnpin = true;
                } else {
                    // Check if message is older than 7 days
                    const messageDate = new Date(pinnedMessage.date * 1000);
                    const now = new Date();
                    const daysDifference = (now - messageDate) / (1000 * 60 * 60 * 24);
                    
                    if (daysDifference > 7) {
                        shouldUnpin = true;
                        console.log(`Pinned message is ${daysDifference.toFixed(1)} days old, updating...`);
                    }
                }
            }
            // If it's not a bot message, we don't unpin it
        }

        if (shouldUnpin) {
            await bot.unpinChatMessage(chatId);
            await deleteMessage(bot, chatId, pinnedMessage.message_id);
        }

        // Only post new message if we unpinned or there was no pinned message
        if (shouldUnpin || !pinnedMessage) {
            const meetupMessage = await fetchMeetupsLogic('dieseWoche');

            // Check if the message indicates no events found
            if (meetupMessage && !meetupMessage.includes('Keine Meetups für den gewählten Zeitraum')) {
                let sentMessage = await sendAndStoreMessage(bot, chatId, meetupMessage, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                }, 'pinnedMeetupMessageId');

                await bot.pinChatMessage(chatId, sentMessage.message_id);
                console.log('New weekly meetup message pinned');
            } else {
                console.log('No meetups found for this week, skipping post');
            }
        } else {
            console.log('Pinned message is still current, no update needed');
        }
    } catch (error) {
        console.error('Error posting weekly meetups:', error);
    }
};


export { scheduleWeeklyMeetupPost, postWeeklyMeetups, checkAndUpdateOnStartup };
