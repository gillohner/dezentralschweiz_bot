import crypto from "crypto";
import ngeohash from "ngeohash";
import { finalizeEvent } from "nostr-tools/pure";
import { getPublicKey, nip19 } from "nostr-tools";
import NDK, { NDKEvent } from "@nostr-dev-kit/ndk";
import config from "../bot/config.js";

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

// Simple NDK initialization
const getNDK = () => {
  const relays = config.DEFAULT_RELAYS?.map((relay) => relay.trim()).filter(
    Boolean
  ) || [
    "wss://relay.nostr.band",
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net",
  ];

  return new NDK({
    explicitRelayUrls: relays,
  });
};

// Wait for at least one relay to connect
const waitForConnection = async (ndk, timeoutMs = 10000) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Connection timeout: No relays connected"));
    }, timeoutMs);

    const checkConnection = () => {
      const connectedRelays = ndk.pool.connectedRelays();
      if (connectedRelays.length > 0) {
        clearTimeout(timeout);
        console.log(`Connected to ${connectedRelays.length} relay(s)`);
        resolve();
      } else {
        // Check again in 100ms
        setTimeout(checkConnection, 100);
      }
    };

    // Start checking immediately
    checkConnection();
  });
};

const fetchEventDirectly = async (filter) => {
  try {
    const ndk = getNDK();
    await ndk.connect();

    // Wait for at least one relay to connect
    await waitForConnection(ndk);

    // Create a subscription for the filter
    const subscription = ndk.subscribe(filter);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription.stop();
        resolve(null);
      }, 15000); // 15 second timeout

      let eventFound = false;

      subscription.on("event", (event) => {
        if (!eventFound) {
          eventFound = true;
          clearTimeout(timeout);
          subscription.stop();
          // Convert NDKEvent to plain object similar to nostr-tools format
          resolve({
            id: event.id,
            pubkey: event.pubkey,
            created_at: event.created_at,
            kind: event.kind,
            tags: event.tags,
            content: event.content,
            sig: event.sig,
          });
        }
      });

      subscription.on("eose", () => {
        if (!eventFound) {
          clearTimeout(timeout);
          subscription.stop();
          resolve(null);
        }
      });

      subscription.start();
    });
  } catch (error) {
    console.error(`Error fetching event with NDK:`, error);
    return null;
  }
};

export const checkForDeletionEvent = async (eventId) => {
  const deletionFilter = {
    kinds: [5],
    "#e": [eventId],
  };

  try {
    const deletionEvent = await fetchEventDirectly(deletionFilter);
    if (deletionEvent) {
      return true; // Deletion event found
    }
  } catch (error) {
    console.error(error);
  }

  console.log(`No deletion event found for ${eventId}`);
  return false; // No deletion event found
};

async function fetchCalendarEvents(calendarNaddr) {
  console.log(`Fetching events for calendar: ${calendarNaddr}`);
  const decoded = nip19.decode(calendarNaddr);
  const calendarFilter = {
    kinds: [31924],
    authors: [decoded.data.pubkey],
    "#d": [decoded.data.identifier],
  };

  try {
    console.log("Fetching calendar event with filter:", calendarFilter);
    const calendarEvent = await fetchEventDirectly(calendarFilter);
    if (!calendarEvent) {
      console.error(`Calendar event not found for ${calendarNaddr}`);
      return {
        calendarName: "Unbekannter Kalender",
        events: [],
        naddr: calendarNaddr,
      };
    }

    console.log("Calendar event found:", calendarEvent);
    const eventReferences = calendarEvent.tags
      .filter((tag) => tag[0] === "a")
      .map((tag) => {
        const [_, eventReference] = tag;
        const [eventKind, eventPubkey, eventIdentifier] =
          eventReference.split(":");
        return {
          kind: parseInt(eventKind),
          pubkey: eventPubkey,
          identifier: eventIdentifier,
        };
      });

    if (eventReferences.length === 0) {
      return {
        calendarName:
          calendarEvent.tags.find((t) => t[0] === "name")?.[1] ||
          "Unbenannter Kalender",
        events: [],
        naddr: calendarNaddr,
      };
    }

    const events = await fetchEvents(eventReferences);
    console.log(
      `Fetched ${events.length} events for calendar ${calendarNaddr}`
    );
    return {
      calendarName:
        calendarEvent.tags.find((t) => t[0] === "name")?.[1] ||
        "Unbenannter Kalender",
      events,
      naddr: calendarNaddr,
    };
  } catch (error) {
    console.error(
      `Error fetching events for calendar ${calendarNaddr}:`,
      error
    );
    return {
      calendarName: "Unbekannter Kalender",
      events: [],
      naddr: calendarNaddr,
    };
  }
}

const fetchEvents = async (eventReferences) => {
  console.log("Fetching events for references:", eventReferences);
  const events = [];
  for (const ref of eventReferences) {
    const filter = {
      kinds: [ref.kind],
      authors: [ref.pubkey],
      "#d": [ref.identifier],
    };
    const event = await fetchEventDirectly(filter);
    if (event) {
      events.push(event);
    }
  }
  return events;
};

const publishEventToNostr = async (eventDetails) => {
  console.log("Publishing event to Nostr:", eventDetails);

  const privateKey = config.BOT_NSEC;
  if (!privateKey) {
    throw new Error("BOT_NSEC is not set in the environment variables");
  }

  const publicKey = getPublicKey(privateKey);

  let eventTemplate;

  if (eventDetails.kind === 5) {
    eventTemplate = eventDetails;
  } else {
    // Creation event (kind 31923)
    const calendarNaddr = config.EVENT_CALENDAR_NADDR;
    if (!calendarNaddr) {
      throw new Error(
        "EVENT_CALENDAR_NADDR is not set in the environment variables"
      );
    }

    const decoded = nip19.decode(calendarNaddr);

    const eventId = crypto.randomBytes(16).toString("hex");
    const startTimestamp = Math.floor(
      new Date(`${eventDetails.date}T${eventDetails.time}`).getTime() / 1000
    );
    const geohash = ngeohash.encode(
      eventDetails.latitude,
      eventDetails.longitude
    );

    eventTemplate = {
      kind: 31923, // Time-Based Calendar Event
      created_at: Math.floor(Date.now() / 1000),
      pubkey: publicKey,
      content: eventDetails.description,
      tags: [
        ["d", eventId],
        ["title", eventDetails.title],
        ["summary", eventDetails.description],
        ["start", startTimestamp.toString()],
        ["start_tzid", "Europe/Zurich"],
        ["location", eventDetails.location],
        ["g", geohash],
        ["p", publicKey, "", "host"],
      ],
    };

    if (eventDetails.gmaps_link)
      eventTemplate.tags.push(["r", eventDetails.gmaps_link]);
    if (eventDetails.applemaps_link)
      eventTemplate.tags.push(["r", eventDetails.applemaps_link]);
    if (eventDetails.osm_link)
      eventTemplate.tags.push(["r", eventDetails.osm_link]);
    if (eventDetails.tg_user_link)
      eventTemplate.tags.push(["r", eventDetails.tg_user_link]);

    if (eventDetails.end_date && eventDetails.end_time) {
      const endTimestamp = Math.floor(
        new Date(
          `${eventDetails.end_date}T${eventDetails.end_time}`
        ).getTime() / 1000
      );
      eventTemplate.tags.push(["end", endTimestamp.toString()]);
      eventTemplate.tags.push(["end_tzid", "Europe/Zurich"]);
    }

    if (eventDetails.image) {
      eventTemplate.tags.push(["image", eventDetails.image]);
    }
  }

  const signedEvent = finalizeEvent(eventTemplate, privateKey);
  console.log("Created Nostr event:", signedEvent);

  // Publish to all relays using NDK
  try {
    await publishToRelay(null, signedEvent); // NDK handles multiple relays
    console.log("Event published successfully");
  } catch (error) {
    console.error(`Error publishing event:`, error);
    throw error; // Re-throw the error to allow caller to handle
  }

  if (eventTemplate.kind === 31923) {
    await updateCalendarEvent(signedEvent, privateKey);
  }

  return signedEvent;
};

const publishToRelay = async (relay, event) => {
  try {
    const ndk = getNDK();
    await ndk.connect();

    // Wait for at least one relay to connect
    await waitForConnection(ndk);

    // Create NDKEvent from the event object
    const ndkEvent = new NDKEvent(ndk, event);

    // Publish the event
    await ndkEvent.publish();
    console.log(`Successfully published event to relays`);
  } catch (error) {
    console.error(`Error publishing event:`, error);
    throw error; // Re-throw to allow caller to handle
  }
};

const updateCalendarEvent = async (newEvent, privateKey) => {
  const calendarId = config.EVENT_CALENDAR_NADDR;
  if (!calendarId) {
    return;
  }

  console.log("Updating calendar with ID:", calendarId);
  const decoded = nip19.decode(calendarId);
  console.log("Decoded calendar ID:", decoded);
  const calendarFilter = {
    kinds: [31924],
    "#d": [decoded.data.identifier],
  };
  console.log("Fetching calendar event with filter:", calendarFilter);
  const calendarEvent = await fetchEventDirectly(calendarFilter);
  console.log("Fetched calendar event:", calendarEvent);

  if (calendarEvent) {
    const calendarPubkey = decoded.data.pubkey;
    calendarEvent.pubkey = calendarPubkey;

    // Find the "d" tag in the new event
    const dTag = newEvent.tags.find((t) => t[0] === "d");
    if (!dTag || !dTag[1]) {
      console.error("No 'd' tag found in new event:", newEvent);
      return;
    }

    const newEventReference = `31923:${newEvent.pubkey}:${dTag[1]}`;
    calendarEvent.tags.push(["a", newEventReference]);
    calendarEvent.created_at = Math.floor(Date.now() / 1000);
    delete calendarEvent.id;
    delete calendarEvent.sig;
    const updatedCalendarEvent = finalizeEvent(calendarEvent, privateKey);
    console.log("Updated calendar event:", updatedCalendarEvent);

    try {
      await publishToRelay(null, updatedCalendarEvent); // NDK handles multiple relays
      console.log("Successfully published updated calendar event");
    } catch (error) {
      console.error("Error publishing updated calendar event:", error);
      // Don't throw here as this is supplementary functionality
    }
  } else {
    console.error("Calendar event not found");
  }
};

export { fetchCalendarEvents, publishEventToNostr, fetchEventDirectly };
