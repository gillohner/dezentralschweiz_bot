// scheduledTasks.js
import schedule from "node-schedule";
import { fetchMeetupsLogic } from "./handlers/meetupHandlers/meetupDisplayingHandler.js";
import {
  deleteMessage,
  sendAndStoreMessage,
  editAndStoreMessage,
} from "./utils/helpers.js";
import config from "./bot/config.js";

const scheduleWeeklyMeetupPost = (bot) => {
  // Check and update on startup (with 7-day check)
  checkAndUpdateOnStartup(bot);

  // Schedule weekly post on Mondays at 7 AM (force update)
  schedule.scheduleJob("0 7 * * 1", async () => {
    console.log("Running scheduled weekly meetup post");
    await postWeeklyMeetups(bot, true); // Force update on scheduled run
  });
};

const checkAndUpdateOnStartup = async (bot) => {
  console.log("Checking pinned messages on startup...");
  try {
    await postWeeklyMeetups(bot, false); // Check 7-day age rule
  } catch (error) {
    console.error("Error checking pinned messages on startup:", error);
  }
};

// Helper function to get all pinned messages from the bot
const getBotPinnedMessages = async (bot, chatId) => {
  try {
    const botInfo = await bot.getMe();
    const chat = await bot.getChat(chatId);

    // Get chat history to find all pinned messages from the bot
    // Note: Telegram doesn't provide a direct API to get all pinned messages
    // We'll work with the current pinned message and assume it's the most recent
    const pinnedMessage = chat.pinned_message;

    if (
      pinnedMessage &&
      pinnedMessage.from &&
      pinnedMessage.from.id === botInfo.id
    ) {
      return [pinnedMessage];
    }

    return [];
  } catch (error) {
    console.error("Error getting bot pinned messages:", error);
    return [];
  }
};

const postWeeklyMeetups = async (bot, isScheduledRun = false) => {
  let chatId = config.MEETUP_CHAT_ID;
  if (!chatId) {
    console.error("MEETUP_CHAT_ID is not set in the environment variables");
    return;
  }

  try {
    const botPinnedMessages = await getBotPinnedMessages(bot, chatId);
    const botInfo = await bot.getMe();
    let shouldPost = true;

    if (isScheduledRun) {
      // Scheduled run: unpin and delete ALL bot messages, then post new
      console.log("Scheduled run: cleaning up all bot pinned messages");
      for (const message of botPinnedMessages) {
        try {
          await bot.unpinChatMessage(chatId);
          await deleteMessage(bot, chatId, message.message_id);
          console.log(`Unpinned and deleted bot message ${message.message_id}`);
        } catch (error) {
          console.error(
            `Error removing bot message ${message.message_id}:`,
            error
          );
        }
      }
    } else {
      // Startup check: apply 7-day rule
      let hasRecentBotMessage = false;
      const messagesToRemove = [];

      for (const message of botPinnedMessages) {
        const messageDate = new Date(message.date * 1000);
        const now = new Date();
        const daysDifference = (now - messageDate) / (1000 * 60 * 60 * 24);

        if (daysDifference > 7) {
          console.log(
            `Bot message ${message.message_id} is ${daysDifference.toFixed(
              1
            )} days old, marking for removal`
          );
          messagesToRemove.push(message);
        } else {
          console.log(
            `Bot message ${message.message_id} is ${daysDifference.toFixed(
              1
            )} days old, keeping it`
          );
          hasRecentBotMessage = true;
        }
      }

      // Remove old messages
      for (const message of messagesToRemove) {
        try {
          await bot.unpinChatMessage(chatId);
          await deleteMessage(bot, chatId, message.message_id);
          console.log(
            `Unpinned and deleted old bot message ${message.message_id}`
          );
        } catch (error) {
          console.error(
            `Error removing old bot message ${message.message_id}:`,
            error
          );
        }
      }

      // Don't post if we have a recent bot message
      if (hasRecentBotMessage) {
        shouldPost = false;
        console.log("Found recent bot pinned message, skipping new post");
      }
    }

    // Post new message if needed
    if (shouldPost) {
      const timeFrame = "dieseWoche";
      const meetupMessage = await fetchMeetupsLogic(timeFrame);

      // Check if the message indicates no events found
      if (
        meetupMessage &&
        !meetupMessage.includes("Keine Meetups für den gewählten Zeitraum")
      ) {
        let sentMessage = await sendAndStoreMessage(
          bot,
          chatId,
          meetupMessage,
          {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          },
          "pinnedMeetupMessageId"
        );

        await bot.pinChatMessage(chatId, sentMessage.message_id);
        console.log("New meetup message pinned");
      } else {
        console.log("No meetups found, skipping post");
      }
    }
  } catch (error) {
    console.error("Error in postWeeklyMeetups:", error);
  }
};

export { scheduleWeeklyMeetupPost, postWeeklyMeetups, checkAndUpdateOnStartup };
