// handlers/calendarEventApprovalHandler.js
import { getNDK } from "../utils/nostrUtils.js";
import {
  extractEventData,
  formatCalendarEventRequestMessage,
  eventCache,
} from "./calendarEventRequestHandler.js";
import config from "../bot/config.js";
import { escapeHTML } from "../utils/helpers.js";
import { nip19, nip04 } from "nostr-tools";

const handleCalendarEventApprovalCallbacks = async (bot, callbackQuery) => {
  const { data, message } = callbackQuery;
  const adminChatId = config.ADMIN_CHAT_ID;

  // Check if the callback is from admin chat
  if (message.chat.id.toString() !== adminChatId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "You are not authorized to perform this action.",
      show_alert: true,
    });
    return;
  }

  try {
    if (data.startsWith("approve_cal:")) {
      const shortEventId = data.replace("approve_cal:", "");
      await approveCalendarEvent(bot, callbackQuery, shortEventId);
    } else if (data.startsWith("reject_cal:")) {
      const shortEventId = data.replace("reject_cal:", "");
      await rejectCalendarEvent(bot, callbackQuery, shortEventId);
    }
  } catch (error) {
    console.error("Error handling calendar event approval:", error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "An error occurred while processing the request.",
      show_alert: true,
    });
  }
};

const approveCalendarEvent = async (bot, callbackQuery, shortEventId) => {
  try {
    console.log(`Approving calendar event: ${shortEventId}`);

    // Get the cached event first
    const event = eventCache.get(shortEventId);
    if (!event) {
      // Fallback: try to fetch from Nostr if not in cache
      const ndk = await getNDK();
      const fetchedEvent = await ndk.fetchEvent(shortEventId);
      if (!fetchedEvent) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Event not found. It may have been deleted.",
          show_alert: true,
        });
        return;
      }
      event = fetchedEvent;
    }

    // Decode calendar info
    const decoded = nip19.decode(config.EVENT_CALENDAR_NADDR);
    const { pubkey: calendarPubkey, identifier: calendarIdentifier } =
      decoded.data;

    // Create calendar update event to include this event
    const ndk = await getNDK();
    await addEventToCalendar(ndk, event, calendarPubkey, calendarIdentifier);

    // Update the message to show approval
    const eventData = extractEventData(event);
    const updatedMessage = `✅ <b>APPROVED</b>\n\n${formatCalendarEventRequestMessage(
      eventData,
      event
    )}`;

    await bot.editMessageText(updatedMessage, {
      chat_id: callbackQuery.message.chat.id,
      message_id: callbackQuery.message.message_id,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Calendar event approved and added to calendar!",
      show_alert: false,
    });

    console.log(`Calendar event ${event.id} approved and added to calendar`);
  } catch (error) {
    console.error("Error approving calendar event:", error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Error approving event. Please try again.",
      show_alert: true,
    });
  }
};

const rejectCalendarEvent = async (bot, callbackQuery, shortEventId) => {
  try {
    console.log(`Rejecting calendar event: ${shortEventId}`);

    // Get the cached event first
    const event = eventCache.get(shortEventId);
    let eventTitle = "Unknown";

    if (event) {
      const eventData = extractEventData(event);
      eventTitle = eventData.title;

      // Update the message to show rejection
      const updatedMessage = `❌ <b>REJECTED</b>\n\n${formatCalendarEventRequestMessage(
        eventData,
        event
      )}`;

      await bot.editMessageText(updatedMessage, {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    }

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Calendar event rejected.",
      show_alert: false,
    });

    console.log(`Calendar event ${shortEventId} rejected`);
  } catch (error) {
    console.error("Error rejecting calendar event:", error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Error rejecting event. Please try again.",
      show_alert: true,
    });
  }
};

const addEventToCalendar = async (
  ndk,
  event,
  calendarPubkey,
  calendarIdentifier
) => {
  try {
    // Get current calendar
    const calendarFilter = {
      kinds: [31924],
      authors: [calendarPubkey],
      "#d": [calendarIdentifier],
    };

    const existingCalendar = await ndk.fetchEvent(calendarFilter);

    if (!existingCalendar) {
      throw new Error("Calendar not found");
    }

    // Create event coordinates
    const eventCoords = `${event.kind}:${event.pubkey}:${
      event.tags.find((t) => t[0] === "d")[1]
    }`;

    // Check if event is already in calendar
    const existingATag = existingCalendar.tags.find(
      (t) => t[0] === "a" && t[1] === eventCoords
    );
    if (existingATag) {
      console.log("Event already exists in calendar");
      return;
    }

    // Create new calendar event with added event
    const newCalendarTags = [...existingCalendar.tags, ["a", eventCoords]];

    const calendarEvent = {
      kind: 31924,
      created_at: Math.floor(Date.now() / 1000),
      content: existingCalendar.content,
      tags: newCalendarTags,
    };

    const ndkEvent = ndk.event(calendarEvent);
    await ndkEvent.sign();
    await ndkEvent.publish();

    console.log(`Added event ${event.id} to calendar ${calendarIdentifier}`);
  } catch (error) {
    console.error("Error adding event to calendar:", error);
    throw error;
  }
};

export {
  handleCalendarEventApprovalCallbacks,
  approveCalendarEvent,
  rejectCalendarEvent,
  addEventToCalendar,
};
