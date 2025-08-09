// handlers/meetupHandlers/meetupApprovalHandler.js
import { getNDK } from "../../utils/nostrUtils.js";
import config from "../../bot/config.js";
import { escapeHTML } from "../../utils/helpers.js";
import { nip19 } from "nostr-tools";
import { addEventToCalendar } from "../calendarEventApprovalHandler.js";

const handleApprovalCallbacks = async (bot, callbackQuery) => {
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
    if (data.startsWith("approve_")) {
      const eventId = data.replace("approve_", "");
      await approveEvent(bot, callbackQuery, eventId);
    } else if (data.startsWith("reject_")) {
      const eventId = data.replace("reject_", "");
      await rejectEvent(bot, callbackQuery, eventId);
    }
  } catch (error) {
    console.error("Error handling meetup approval:", error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "An error occurred while processing the request.",
      show_alert: true,
    });
  }
};

const approveEvent = async (bot, callbackQuery, eventId) => {
  try {
    console.log(`Approving meetup event: ${eventId}`);

    // Get the original event
    const ndk = await getNDK();
    const event = await ndk.fetchEvent(eventId);

    if (!event) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Event not found. It may have been deleted.",
        show_alert: true,
      });
      return;
    }

    // Publish the approved event to relays
    await event.publish();

    // Also add the event to the calendar
    const decoded = nip19.decode(config.EVENT_CALENDAR_NADDR);
    const { pubkey: calendarPubkey, identifier: calendarIdentifier } = decoded.data;
    await addEventToCalendar(ndk, event, calendarPubkey, calendarIdentifier);

    // Update the message to show approval
    const updatedMessage = `✅ <b>APPROVED</b>\n\n${callbackQuery.message.text}`;

    await bot.editMessageText(updatedMessage, {
      chat_id: callbackQuery.message.chat.id,
      message_id: callbackQuery.message.message_id,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Meetup approved and published!",
      show_alert: false,
    });

    console.log(`Meetup event ${eventId} approved and published`);
  } catch (error) {
    console.error("Error approving meetup event:", error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Error approving event. Please try again.",
      show_alert: true,
    });
  }
};

const rejectEvent = async (bot, callbackQuery, eventId) => {
  try {
    console.log(`Rejecting meetup event: ${eventId}`);

    // Get the original event for logging
    const ndk = await getNDK();
    const event = await ndk.fetchEvent(eventId);

    let eventTitle = "Unknown";
    if (event) {
      eventTitle = getEventTitle(event);
    }

    // Update the message to show rejection
    const updatedMessage = `❌ <b>REJECTED</b>\n\n${callbackQuery.message.text}`;

    await bot.editMessageText(updatedMessage, {
      chat_id: callbackQuery.message.chat.id,
      message_id: callbackQuery.message.message_id,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Meetup rejected.",
      show_alert: false,
    });

    console.log(`Meetup event ${eventId} rejected`);
  } catch (error) {
    console.error("Error rejecting meetup event:", error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Error rejecting event. Please try again.",
      show_alert: true,
    });
  }
};

const getEventTitle = (event) => {
  try {
    const titleTag = event.tags.find((t) => t[0] === "title");
    const nameTag = event.tags.find((t) => t[0] === "name");
    return titleTag ? titleTag[1] : nameTag ? nameTag[1] : "Untitled Event";
  } catch (error) {
    return "Unknown Event";
  }
};

export { handleApprovalCallbacks, approveEvent, rejectEvent };
