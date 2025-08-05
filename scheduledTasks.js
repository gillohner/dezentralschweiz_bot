// scheduledTasks.js
import schedule from "node-schedule";
import { fetchMeetupsLogic } from "./handlers/meetupHandlers/meetupDisplayingHandler.js";
import {
  deleteMessage,
  sendAndStoreMessage,
  editAndStoreMessage,
} from "./utils/helpers.js";
import config from "./bot/config.js";

// Store information about previously posted events to detect new ones
let lastPostedEvents = new Set();
let lastPostDate = null;

const scheduleWeeklyMeetupPost = (bot) => {
  // Check and update on startup (with 7-day check)
  checkAndUpdateOnStartup(bot);

  // Schedule weekly post on Mondays at 7 AM (force update)
  schedule.scheduleJob("0 7 * * 1", async () => {
    console.log("Running scheduled weekly meetup post (Monday 6 AM)");
    await postWeeklyMeetups(bot, true); // Force update on scheduled run
  });

  // Schedule daily check for new events at 7 AM (except Monday since that's handled above)
  schedule.scheduleJob("0 7 * * 2-7,0", async () => {
    console.log("Running daily check for new events");
    await checkForNewEvents(bot);
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

// Check for new events and post immediately if found
const checkForNewEvents = async (bot) => {
  let chatId = config.MEETUP_CHAT_ID;
  if (!chatId) {
    console.error("MEETUP_CHAT_ID is not set in the environment variables");
    return;
  }

  try {
    // Get current week's events
    const timeFrame = "dieseWoche";
    const meetupMessage = await fetchMeetupsLogic(timeFrame);

    // Skip if no events found
    if (
      !meetupMessage ||
      meetupMessage.includes("Keine Meetups für den gewählten Zeitraum")
    ) {
      console.log("No events found for this week, skipping new event check");
      return;
    }

    // Extract event identifiers from the current message
    const currentEvents = extractEventIdentifiers(meetupMessage);

    // Check if we have new events compared to last post
    const newEvents = [...currentEvents].filter(
      (event) => !lastPostedEvents.has(event)
    );

    if (newEvents.length > 0) {
      console.log(`Found ${newEvents.length} new event(s):`, newEvents);

      // Post the updated message immediately
      await postWeeklyMeetups(bot, true, "Neue Events hinzugefügt! 🎉\n\n");

      console.log("Posted update due to new events");
    } else {
      console.log("No new events found, keeping current schedule");
    }
  } catch (error) {
    console.error("Error checking for new events:", error);
  }
};

// Extract event identifiers from a meetup message to detect changes
const extractEventIdentifiers = (message) => {
  const eventIdentifiers = new Set();

  // Extract event titles/URLs as identifiers
  const eventLinkRegex = /<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let match;

  while ((match = eventLinkRegex.exec(message)) !== null) {
    const url = match[1];
    const title = match[2];

    // Use URL as unique identifier (more reliable than title)
    if (url.includes("meetstr.com/event/")) {
      eventIdentifiers.add(url);
    }
  }

  return eventIdentifiers;
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

const postWeeklyMeetups = async (
  bot,
  isScheduledRun = false,
  customPrefix = ""
) => {
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

      // Reset tracking for scheduled runs
      if (!customPrefix) {
        lastPostedEvents.clear();
        lastPostDate = new Date();
        console.log("Reset event tracking for new week");
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
        // Add custom prefix if provided (for new event notifications)
        const finalMessage = customPrefix
          ? customPrefix + meetupMessage
          : meetupMessage;

        let sentMessage = await sendAndStoreMessage(
          bot,
          chatId,
          finalMessage,
          {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          },
          "pinnedMeetupMessageId"
        );

        await bot.pinChatMessage(chatId, sentMessage.message_id);
        console.log("New meetup message pinned");

        // Update tracking with current events
        lastPostedEvents = extractEventIdentifiers(meetupMessage);
        lastPostDate = new Date();
        console.log(
          `Tracking ${lastPostedEvents.size} events for change detection`
        );
      } else {
        console.log("No meetups found, skipping post");
      }
    }
  } catch (error) {
    console.error("Error in postWeeklyMeetups:", error);
  }
};

export {
  scheduleWeeklyMeetupPost,
  postWeeklyMeetups,
  checkAndUpdateOnStartup,
  checkForNewEvents,
};
