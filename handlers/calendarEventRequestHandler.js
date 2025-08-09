// handlers/calendarEventRequestHandler.js
import { getNDK } from "../utils/nostrUtils.js";
import config from "../bot/config.js";
import { escapeHTML } from "../utils/helpers.js";
import { nip19 } from "nostr-tools";

let isListening = false;
let eventCache = new Map(); // Cache to store full event data by short ID

const startCalendarEventListener = async (bot) => {
  if (isListening) {
    console.log("Calendar event listener is already running");
    return;
  }

  if (!config.EVENT_CALENDAR_NADDR) {
    console.error(
      "EVENT_CALENDAR_NADDR not configured, skipping calendar event listener"
    );
    return;
  }

  if (!config.ADMIN_CHAT_ID) {
    console.error(
      "ADMIN_CHAT_ID not configured, skipping calendar event listener"
    );
    return;
  }

  try {
    console.log("Starting calendar event request listener...");
    const ndk = await getNDK();

    // Decode the calendar naddr to get the pubkey and identifier
    const decoded = nip19.decode(config.EVENT_CALENDAR_NADDR);
    if (decoded.type !== "naddr") {
      throw new Error("Invalid EVENT_CALENDAR_NADDR format");
    }

    const { pubkey: calendarPubkey, identifier: calendarIdentifier } =
      decoded.data;
    console.log(
      `Listening for events requesting addition to calendar: ${calendarIdentifier}`
    );

    // Subscribe to calendar events (kinds 31922 and 31923) that reference our calendar
    const subscription = ndk.subscribe(
      [
        {
          kinds: [31922, 31923], // Date-based and time-based calendar events
          "#a": [`31924:${calendarPubkey}:${calendarIdentifier}`],
          since: Math.floor(Date.now() / 1000) - 60, // Start from 1 minute ago to catch recent events
        },
      ],
      { closeOnEose: false }
    );

    subscription.on("event", async (event) => {
      try {
        console.log(`Received calendar event request: ${event.id}`);
        await handleCalendarEventRequest(
          bot,
          event,
          calendarPubkey,
          calendarIdentifier
        );
      } catch (error) {
        console.error("Error handling calendar event request:", error);
      }
    });

    subscription.on("eose", () => {
      console.log("Calendar event listener: End of stored events");
    });

    subscription.on("close", () => {
      console.log("Calendar event subscription closed");
      isListening = false;
    });

    isListening = true;
    console.log("Calendar event request listener started successfully");
  } catch (error) {
    console.error("Error starting calendar event listener:", error);
    isListening = false;
  }
};

const handleCalendarEventRequest = async (
  bot,
  event,
  calendarPubkey,
  calendarIdentifier
) => {
  try {
    // Extract event details
    const eventData = extractEventData(event);

    // Store full event in cache with short ID
    const shortEventId = event.id.substring(0, 16);
    eventCache.set(shortEventId, event);

    // Create approval message
    const message = formatCalendarEventRequestMessage(eventData, event);

    // Create inline keyboard for approval/rejection (with shortened callback data)
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "✅ Approve Event",
            callback_data: `approve_cal:${shortEventId}`,
          },
          {
            text: "❌ Reject Event",
            callback_data: `reject_cal:${shortEventId}`,
          },
        ],
      ],
    };

    // Send to admin chat
    await bot.sendMessage(config.ADMIN_CHAT_ID, message, {
      parse_mode: "HTML",
      reply_markup: JSON.stringify(keyboard),
      disable_web_page_preview: true,
    });

    console.log(`Calendar event request sent to admin chat: ${event.id}`);
  } catch (error) {
    console.error("Error handling calendar event request:", error);
  }
};

const extractEventData = (event) => {
  const getTag = (tagName) => {
    const tag = event.tags.find((t) => t[0] === tagName);
    return tag ? tag[1] : null;
  };

  const getAllTags = (tagName) => {
    return event.tags.filter((t) => t[0] === tagName).map((t) => t[1]);
  };

  return {
    id: event.id,
    kind: event.kind,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    content: event.content || "",
    title: getTag("title") || getTag("name") || "Untitled Event",
    summary: getTag("summary"),
    start: getTag("start"),
    end: getTag("end"),
    startTzid: getTag("start_tzid"),
    endTzid: getTag("end_tzid"),
    locations: getAllTags("location"),
    geohash: getTag("g"),
    image: getTag("image"),
    participants: event.tags.filter((t) => t[0] === "p"),
    hashtags: getAllTags("t"),
    references: getAllTags("r"),
  };
};

const formatCalendarEventRequestMessage = (eventData, rawEvent) => {
  const eventType =
    eventData.kind === 31922 ? "📅 Date-based" : "🕐 Time-based";
  const authorNpub = nip19.npubEncode(eventData.pubkey);

  // Create njump link for author
  const njumpAuthorLink = `https://njump.me/${authorNpub}`;

  // Create meetstr calendar link
  const meetstrCalendarLink = `https://meetstr.com/calendar/${config.EVENT_CALENDAR_NADDR}`;

  // Create event naddr for meetstr link
  const dTag = rawEvent.tags.find((t) => t[0] === "d");
  const eventIdentifier = dTag ? dTag[1] : rawEvent.id;

  // Create proper naddr for the event
  const eventNaddr = nip19.naddrEncode({
    kind: rawEvent.kind,
    pubkey: rawEvent.pubkey,
    identifier: eventIdentifier,
  });
  const meetstrEventLink = `https://meetstr.com/event/${eventNaddr}`;

  let message = `🎉 <b>New Calendar Event Request</b>\n\n`;
  message += `<b>Type:</b> ${eventType} Event\n`;
  message += `<b>Title:</b> <a href="${meetstrEventLink}">${escapeHTML(
    eventData.title
  )}</a>\n`;

  if (eventData.summary) {
    message += `<b>Summary:</b> ${escapeHTML(eventData.summary)}\n`;
  }

  // Format dates/times based on event type
  if (eventData.kind === 31922) {
    // Date-based event
    message += `<b>Start Date:</b> ${eventData.start}\n`;
    if (eventData.end) {
      message += `<b>End Date:</b> ${eventData.end}\n`;
    }
  } else {
    // Time-based event
    const startDate = new Date(parseInt(eventData.start) * 1000);
    message += `<b>Start:</b> ${startDate.toLocaleString("de-CH")}\n`;
    if (eventData.end) {
      const endDate = new Date(parseInt(eventData.end) * 1000);
      message += `<b>End:</b> ${endDate.toLocaleString("de-CH")}\n`;
    }
    if (eventData.startTzid) {
      message += `<b>Timezone:</b> ${eventData.startTzid}\n`;
    }
  }

  if (eventData.locations.length > 0) {
    message += `<b>Location:</b> ${escapeHTML(eventData.locations[0])}\n`;
  }

  if (eventData.content) {
    const truncatedContent =
      eventData.content.length > 200
        ? eventData.content.substring(0, 200) + "..."
        : eventData.content;
    message += `<b>Description:</b> ${escapeHTML(truncatedContent)}\n`;
  }

  message += `\n<b>Author:</b> <a href="${njumpAuthorLink}">${authorNpub.substring(
    0,
    16
  )}...</a>\n`;
  message += `<b>Target Calendar:</b> <a href="${meetstrCalendarLink}">Dezentralschweiz</a>\n`;
  message += `\n<i>Please review and approve/reject this calendar event request.</i>`;

  return message;
};

export {
  startCalendarEventListener,
  handleCalendarEventRequest,
  extractEventData,
  formatCalendarEventRequestMessage,
  eventCache,
};
