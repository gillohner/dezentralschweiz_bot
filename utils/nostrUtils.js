import WebSocket from 'ws';
import crypto from 'crypto';
import ngeohash from 'ngeohash';
import {
    finalizeEvent
} from 'nostr-tools/pure';
import {
    getPublicKey,
    nip19
} from 'nostr-tools';
import config from '../config.js';

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

const getEventHash = (event) => {
    const serialized = JSON.stringify([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content
    ]);
    return sha256(serialized);
};

const fetchEventDirectly = async (filter) => {

    try {
        const event = await new Promise((resolve, reject) => {
            const ws = new WebSocket(config.FETCH_RELAY);
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Timeout'));
            }, 10000);

            ws.on('open', () => {
                const subscriptionMessage = JSON.stringify(["REQ", "my-sub", filter]);
                ws.send(subscriptionMessage);
            });

            ws.on('message', (data) => {
                const message = JSON.parse(data);
                if (message[0] === 'EVENT' && message[1] === 'my-sub') {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(message[2]);
                } else if (message[0] === 'EOSE') {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(null);
                }
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error for ${config.FETCH_RELAY}:`, error);
                clearTimeout(timeout);
                reject(error);
            });
        });

        if (event) {

            // Check for deletion events
            const deletionEvent = await checkForDeletionEvent(event.id);
            if (deletionEvent) {
                return null;
            }
            return event;
        }
    } catch (error) {
        console.error(`Error fetching event from relay ${config.FETCH_RELAY}:`, error);
    }

    return null;
};


export const checkForDeletionEvent = async (eventId) => {
    const deletionFilter = {
        kinds: [5],
        '#e': [eventId]
    };

    try {
        const deletionEvent = await fetchEventDirectly(deletionFilter);
        if (deletionEvent) {
            return true; // Deletion event found
        }
    } catch (error) {
        console.error(`Error checking for deletion event on relay ${config.FETCH_RELAY}:`, error);
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
        console.log('Fetching calendar event with filter:', calendarFilter);
        const calendarEvent = await fetchEventDirectly(calendarFilter);
        if (!calendarEvent) {
            console.error(`Calendar event not found for ${calendarNaddr}`);
            return {
                calendarName: 'Unbekannter Kalender',
                events: [],
                naddr: calendarNaddr
            };
        }

        console.log('Calendar event found:', calendarEvent);
        const eventReferences = calendarEvent.tags
            .filter(tag => tag[0] === 'a')
            .map(tag => {
                const [_, eventReference] = tag;
                const [eventKind, eventPubkey, eventIdentifier] = eventReference.split(':');
                return {
                    kind: parseInt(eventKind),
                    pubkey: eventPubkey,
                    identifier: eventIdentifier
                };
            });

        if (eventReferences.length === 0) {
            return {
                calendarName: calendarEvent.tags.find(t => t[0] === 'name')?. [1] || 'Unbenannter Kalender',
                events: [],
                naddr: calendarNaddr
            };
        }

        const events = await fetchEvents(eventReferences);
        console.log(`Fetched ${events.length} events for calendar ${calendarNaddr}`);
        return {
            calendarName: calendarEvent.tags.find(t => t[0] === 'name')?. [1] || 'Unbenannter Kalender',
            events,
            naddr: calendarNaddr
        };
    } catch (error) {
        console.error(`Error fetching events for calendar ${calendarNaddr}:`, error);
        return {
            calendarName: 'Unbekannter Kalender',
            events: [],
            naddr: calendarNaddr
        };
    }
}

const fetchEvents = async (eventReferences) => {
    console.log('Fetching events for references:', eventReferences);
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
    console.log('Publishing event to Nostr:', eventDetails);

    const privateKey = config.BOT_NSEC;
    if (!privateKey) {
        throw new Error('BOT_NSEC is not set in the environment variables');
    }

    const publicKey = getPublicKey(privateKey);

    let eventTemplate;

    if (eventDetails.kind === 5) {
        eventTemplate = eventDetails;
    } else {
        // Creation event (kind 31923)
        const calendarNaddr = config.EVENT_CALENDAR_NADDR;
        if (!calendarNaddr) {
            throw new Error('EVENT_CALENDAR_NADDR is not set in the environment variables');
        }


        const decoded = nip19.decode(calendarNaddr);
        const calendarPubkey = decoded.data.pubkey;
        const calendarIdentifier = decoded.data.identifier;

        const eventId = crypto.randomBytes(16).toString('hex');
        const startTimestamp = Math.floor(new Date(`${eventDetails.date}T${eventDetails.time}`).getTime() / 1000);
        const geohash = ngeohash.encode(eventDetails.latitude, eventDetails.longitude); //TODO fix geohash by setting at fetch

        eventTemplate = {
            kind: 31923, // Time-Based Calendar Event
            created_at: Math.floor(Date.now() / 1000),
            pubkey: publicKey,
            content: eventDetails.description,
            tags: [
                ['d', eventId],
                ['name', eventDetails.title],
                ['start', startTimestamp.toString()],
                ['start_tzid', "Europe/Zurich"],
                ['location', eventDetails.location],
                ['g', geohash],
                ['description', eventDetails.description],
                ['p', calendarPubkey, '', 'host'],
                ['a', calendarNaddr],
                ['calendar', `31924:${calendarPubkey}:${calendarIdentifier}`],
            ],
        };

        if (eventDetails.gmaps_link) eventTemplate.tags.push(['r', eventDetails.gmaps_link]);
        if (eventDetails.applemaps_link) eventTemplate.tags.push(['r', eventDetails.applemaps_link]);
        if (eventDetails.osm_link) eventTemplate.tags.push(['r', eventDetails.osm_link]);
        if (eventDetails.tg_user_link) eventTemplate.tags.push(['r', eventDetails.tg_user_link]);

        if (eventDetails.end_date && eventDetails.end_time) {
            const endTimestamp = Math.floor(new Date(`${eventDetails.end_date}T${eventDetails.end_time}`).getTime() / 1000);
            eventTemplate.tags.push(['end', endTimestamp.toString()]);
            eventTemplate.tags.push(['end_tzid', "Europe/Zurich"]);
        }

        if (eventDetails.image) {
            eventTemplate.tags.push(['image', eventDetails.image]);
        }
    }

    const signedEvent = finalizeEvent(eventTemplate, privateKey);
    console.log('Created Nostr event:', signedEvent);

    for (const relay of config.DEFAULT_RELAYS) {
        try {
            await publishToRelay(relay, signedEvent);
        } catch (error) {
            console.error(`Error publishing event to relay ${relay}:`, error);
        }
    }

    if (eventTemplate.kind === 31923) {
        console.log("Trying to update calendar: ", signedEvent)
        await updateCalendarEvent(signedEvent, privateKey);
    }

    return signedEvent;
};

const publishToRelay = (relay, event) => {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(relay);
        ws.on('open', () => {
            ws.send(JSON.stringify(['EVENT', event]));
            ws.close();
            resolve();
        });
        ws.on('error', (error) => {
            console.error(`Error connecting to relay ${relay}:`, error);
            reject(error);
        });
    });
};

const updateCalendarEvent = async (newEvent, privateKey) => {
    const calendarId = config.EVENT_CALENDAR_NADDR;
    if (!calendarId) {
        console.error('EVENT_CALENDAR_NADDR is not set in environment variables');
        return;
    }

    console.log('Updating calendar with ID:', calendarId);
    const decoded = nip19.decode(calendarId);
    console.log('Decoded calendar ID:', decoded);
    const calendarFilter = {
        kinds: [31924],
        authors: [decoded.data.pubkey],
        "#d": [decoded.data.identifier],
    };
    console.log('Fetching calendar event with filter:', calendarFilter);
    const calendarEvent = await fetchEventDirectly(calendarFilter);
    console.log('Fetched calendar event:', calendarEvent);

    if (calendarEvent) {
        const calendarPubkey = decoded.data.pubkey;
        calendarEvent.pubkey = calendarPubkey;
        const newEventReference = `31923:${newEvent.pubkey}:${newEvent.tags.find(t => t[0] === 'd')[1]}`;
        calendarEvent.tags.push(['a', newEventReference]);
        calendarEvent.created_at = Math.floor(Date.now() / 1000);
        delete calendarEvent.id;
        delete calendarEvent.sig;
        const updatedCalendarEvent = finalizeEvent(calendarEvent, privateKey);
        console.log('Updated calendar event:', updatedCalendarEvent);

        for (const relay of config.DEFAULT_RELAYS) {
            try {
                console.log(`Publishing updated calendar event to relay: ${relay}`);
                await publishToRelay(relay, updatedCalendarEvent);
            } catch (error) {
                console.error(`Error publishing updated calendar event to relay ${relay}:`, error);
            }
        }
    } else {
        console.error('Calendar event not found');
    }
};

export {
    fetchCalendarEvents,
    publishEventToNostr,
    fetchEventDirectly
};