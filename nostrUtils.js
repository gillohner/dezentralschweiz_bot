const WebSocket = require('ws');
const config = require('./config');
const {
    getPublicKey,
    finalizeEvent
} = require('nostr-tools/pure');
const {
    nip19
} = require('nostr-tools');

async function fetchEventDirectly(filter) {
    for (const relay of config.DEFAULT_RELAYS) {
        try {
            const event = await new Promise((resolve, reject) => {
                const ws = new WebSocket(relay);
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
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            if (event) return event;
        } catch (error) {
            console.error(`Error fetching event from relay ${relay}:`, error);
        }
    }
    return null;
}

async function fetchCalendarEvents(calendarId, naddr) {
    console.log(`Fetching events for calendar: ${calendarId}`);
    const [kind, pubkey, identifier] = calendarId.split(':');

    const calendarFilter = {
        kinds: [parseInt(kind)],
        authors: [pubkey],
        "#d": [identifier],
    };

    try {
        console.log('Fetching calendar event with filter:', calendarFilter);
        const calendarEvent = await fetchEventDirectly(calendarFilter);

        if (!calendarEvent) {
            console.error(`Calendar event not found for ${calendarId}`);
            return {
                calendarName: 'Unbekannter Kalender',
                events: [],
                naddr
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

        console.log('Event references:', eventReferences);

        if (eventReferences.length === 0) {
            return {
                calendarName: calendarEvent.tags.find(t => t[0] === 'name')?. [1] || 'Unbenannter Kalender',
                events: [],
                naddr
            };
        }

        const eventsFilter = {
            kinds: [31923],
            authors: [pubkey],
            "#d": eventReferences.map(ref => ref.identifier),
        };

        console.log('Fetching events with filter:', eventsFilter);
        const events = await fetchEventsDirectly(eventsFilter);
        console.log(`Fetched ${events.length} events for calendar ${calendarId}`);
        return {
            calendarName: calendarEvent.tags.find(t => t[0] === 'name')?. [1] || 'Unbenannter Kalender',
            events,
            naddr
        };
    } catch (error) {
        console.error(`Error fetching events for calendar ${calendarId}:`, error);
        return {
            calendarName: 'Unbekannter Kalender',
            events: [],
            naddr
        };
    }
}

async function fetchEventsDirectly(filter) {
    const events = [];
    for (const relay of config.DEFAULT_RELAYS) {
        try {
            const ws = new WebSocket(relay);
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    resolve();
                }, 10000);

                ws.on('open', () => {
                    const subscriptionMessage = JSON.stringify(["REQ", "my-sub", filter]);
                    ws.send(subscriptionMessage);
                });

                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    if (message[0] === 'EVENT' && message[1] === 'my-sub') {
                        events.push(message[2]);
                    } else if (message[0] === 'EOSE') {
                        clearTimeout(timeout);
                        ws.close();
                        resolve();
                    }
                });

                ws.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
        } catch (error) {
            console.error(`Error fetching events from relay ${relay}:`, error);
        }
    }
    return events;
}
async function publishEventToNostr(eventDetails) {
    console.log('Publishing event to Nostr:', eventDetails);
    const privateKey = process.env.BOT_NSEC;
    if (!privateKey) {
        throw new Error('BOT_NSEC is not set in the environment variables');
    }
    const publicKey = getPublicKey(privateKey);

    const calendarNaddr = process.env.EVENT_CALENDAR_NADDR;
    if (!calendarNaddr) {
        throw new Error('EVENT_CALENDAR_NADDR is not set in the environment variables');
    }

    const startTimestamp = Math.floor(new Date(`${eventDetails.date}T${eventDetails.time}`).getTime() / 1000);
    const eventId = `${Date.now()}`;

    let eventTemplate = {
        kind: 31923,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', eventId],
            ['title', eventDetails.title],
            ['start', startTimestamp.toString()],
            ['location', eventDetails.location],
            ['description', eventDetails.description],
            ['a', calendarNaddr],
        ],
        content: '', // NIP-52 suggests using content for backwards compatibility if needed
    };

    // This assigns the pubkey, calculates the event id and signs the event in a single step
    const signedEvent = finalizeEvent(eventTemplate, privateKey);
    console.log('Created Nostr event:', signedEvent);

    // Publish to relays
    for (const relay of config.DEFAULT_RELAYS) {
        try {
            console.log(`Publishing event to relay: ${relay}`);
            await publishToRelay(relay, signedEvent);
        } catch (error) {
            console.error(`Error publishing event to relay ${relay}:`, error);
        }
    }

    // Update the calendar event
    await updateCalendarEvent(signedEvent, privateKey);

    return signedEvent;
}

async function publishToRelay(relay, event) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(relay);
        ws.on('open', () => {
            ws.send(JSON.stringify(['EVENT', event]));
            console.log(`Event sent to relay: ${relay}`);
            ws.close();
            resolve();
        });
        ws.on('error', (error) => {
            console.error(`Error connecting to relay ${relay}:`, error);
            reject(error);
        });
    });
}

async function updateCalendarEvent(newEvent, privateKey) {
    const calendarId = process.env.EVENT_CALENDAR_NADDR;
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
        const newEventReference = `31923:${newEvent.pubkey}:${newEvent.tags.find(t => t[0] === 'd')[1]}`;
        calendarEvent.tags.push(['a', newEventReference]);
        calendarEvent.created_at = Math.floor(Date.now() / 1000);
        delete calendarEvent.id;
        delete calendarEvent.sig;

        const updatedCalendarEvent = finalizeEvent(calendarEvent, privateKey);
        console.log('Updated calendar event:', updatedCalendarEvent);

        // Publish updated calendar event
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
}

module.exports = {
    fetchCalendarEvents,
    publishEventToNostr
};