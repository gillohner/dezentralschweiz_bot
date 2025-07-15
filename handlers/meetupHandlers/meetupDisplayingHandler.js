// handlers/meetupHandlers/meetupDisplayingHandler.js

import userStates from "../../userStates.js";
import config from "../../bot/config.js";
import {
  extractTelegramUsername,
  formatLocation,
  formatDate,
  escapeHTML,
} from "../../utils/helpers.js";
import { nip19 } from "nostr-tools";
import {
  deleteMessageWithTimeout,
  sendAndStoreMessage,
  deleteMessage,
  editAndStoreMessage,
} from "../../utils/helpers.js";
import { fetchMeetupsFromAPI } from "../../utils/apiCalendar.js";
import {
  getTimeFrameName,
  getCallbackData,
} from "../../utils/timeFrameUtils.js";

const handleMeetups = async (bot, msg) => {
  const chatId = msg.chat.id;
  const timeFrames = ["heute", "dieseWoche", "7Tage", "30Tage", "alle"];
  const keyboard = {
    inline_keyboard: timeFrames.map((timeFrame) => [
      {
        text: getTimeFrameName(timeFrame),
        callback_data: getCallbackData(timeFrame),
      },
    ]),
  };

  // Delete the user's /meetup command message
  deleteMessage(bot, chatId, msg.message_id);

  const sentMessage = await sendAndStoreMessage(
    bot,
    chatId,
    "Wähle den Zeitraum für die Meetups:",
    {
      reply_markup: JSON.stringify(keyboard),
      disable_notification: true,
    },
    "lastMeetupMessageId"
  );

  deleteMessageWithTimeout(bot, chatId, sentMessage.message_id);
};

const handleMeetupsFilter = async (
  bot,
  msg,
  timeFrame,
  returnMessage = "lastMeetupMessageId"
) => {
  const chatId = msg.chat.id;

  try {
    if (userStates[chatId]?.lastMeetupMessageId) {
      await deleteMessage(bot, chatId, userStates[chatId].lastMeetupMessageId);
    }

    const loadingMessage = await bot.sendMessage(
      chatId,
      "Mining new Meetups, bitte warten...",
      {
        disable_notification: true,
      }
    );

    const meetupMessage = await fetchMeetupsLogic(timeFrame);

    const sentMessage = await editAndStoreMessage(
      bot,
      chatId,
      meetupMessage,
      {
        chat_id: chatId,
        message_id: loadingMessage.message_id,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        disable_notification: true,
      },
      returnMessage
    );

    if (returnMessage === "lastMeetupMessageId") {
      deleteMessageWithTimeout(bot, chatId, sentMessage.message_id);
    }

    return returnMessage ? meetupMessage : undefined;
  } catch (error) {
    console.error("Error in handleMeetupsFilter:", error);
    const errorMessageText =
      "Ein Fehler ist beim Mining der Meetups aufgetreten. Bitte versuche es später erneut.";

    if (returnMessage) {
      return errorMessageText;
    }

    const errorMessage = await sendAndStoreMessage(
      bot,
      chatId,
      errorMessageText,
      {
        disable_notification: true,
      },
      returnMessage
    );

    deleteMessageWithTimeout(bot, chatId, errorMessage.message_id);
  }
};

const formatMeetupsMessage = async (calendar, timeFrame) => {
  const events = calendar.upcoming;
  console.log(events);
  console.log(calendar);
  let message = `🍻 **${getHeaderMessage(timeFrame)}** 🍻\n\n`;

  if (events.length > 0) {
    message += `<b>📅 <a href="${calendar.meetstrUrl}">${escapeHTML(
      calendar.metadata.title
    )}</a></b>\n\n`;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      const title = event.metadata.title;
      if (!title) continue;

      const start = event.metadata.start;
      if (!start) continue;

      const end = event.metadata.end;

      message += `🎉 <b><a href="${event.metadata.meetstrUrl}">${escapeHTML(
        title
      )}</a></b>\n`;
      message += `🕒 ${formatDate(parseInt(start) * 1000)}`;
      if (end) {
        message += ` - ${formatDate(parseInt(end) * 1000)}`;
      }
      message += `\n`;

      const telegramUser = extractTelegramUsername(event.metadata.references);
      if (telegramUser) {
        message += `👤 ${escapeHTML(telegramUser)}\n`;
      }

      if (event) {
        message += await formatLocation(event);
      }

      if (i < events.length - 1) {
        message += "\n\n";
      }
    }
  }

  return message;
};

const fetchMeetupsLogic = async (timeFrame) => {
  const now = new Date();
  let fromDate = now;
  let toDate = new Date(now);

  switch (timeFrame) {
    case "heute":
      break;
    case "dieseWoche":
      toDate.setDate(now.getDate() + (7 - now.getDay()));
      break;
    case "7Tage":
      toDate.setDate(now.getDate() + 7);
      break;
    case "30Tage":
      toDate.setDate(now.getDate() + 30);
      break;
    case "alle":
      toDate.setFullYear(now.getFullYear() + 1);
      break;
    default:
      toDate.setFullYear(now.getFullYear() + 1);
  }

  const from = fromDate.toISOString().slice(0, 10);
  const to = toDate.toISOString().slice(0, 10);

  const calendar = await fetchMeetupsFromAPI(from, to);
  const events = calendar.upcoming;
  console.log(
    `Fetched ${events.length} events from API for time frame: ${timeFrame}`
  );
  if (!events.length) {
    return `Keine Meetups für den gewählten Zeitraum (${getHeaderMessage(
      timeFrame
    )}) gefunden.`;
  }

  return await formatMeetupsMessage(calendar, timeFrame);
};

const getHeaderMessage = (timeFrame) => {
  switch (timeFrame) {
    case "heute":
      return "Meetups heute";
    case "dieseWoche":
      return "Meetups diese Woche";
    case "7Tage":
      return "Meetups in den nächsten 7 Tagen";
    case "30Tage":
      return "Meetups in den nächsten 30 Tagen";
    default:
      return "Alle bevorstehenden Meetups";
  }
};

export {
  handleMeetups,
  handleMeetupsFilter,
  formatMeetupsMessage,
  getHeaderMessage,
  fetchMeetupsLogic,
};
