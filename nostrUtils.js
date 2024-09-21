import WebSocket from 'ws';
import crypto from 'crypto';
import {
    getPublicKey,
    finalizeEvent
} from 'nostr-tools/pure';
import {
    nip19
} from 'nostr-tools';
import config from './config.js';

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
    if (filter.ids && filter.ids[0].startsWith('naddr1')) {
        try {
            const decoded = nip19.decode(filter.ids[0]);
            if (decoded.type === 'naddr') {
                filter = {
                    kinds: [decoded.data.kind],
                    authors: [decoded.data.pubkey],
                    "#d": [decoded.data.identifier]
                };
            }
        } catch (error) {
            console.error('Error decoding NADDR:', error);
            return null;
        }
    }

    console.log('Using decoded filter:', filter);

    for (const relay of config.DEFAULT_RELAYS) {
        try {
            console.log(`Trying relay: ${relay}`);
            const event = await new Promise((resolve, reject) => {
                const ws = new WebSocket(relay);
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('Timeout'));
                }, 10000);

                ws.on('open', () => {
                    console.log(`Connected to relay: ${relay}`);
                    const subscriptionMessage = JSON.stringify(["REQ", "my-sub", filter]);
                    ws.send(subscriptionMessage);
                    console.log(`Sent subscription message: ${subscriptionMessage}`);
                });

                ws.on('message', (data) => {
                    const message = JSON.parse(data);
                    console.log(`Received message from ${relay}:`, message);
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
                    console.error(`WebSocket error for ${relay}:`, error);
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            if (event) {
                console.log(`Event found on relay ${relay}:`, event);
                return event;
            }
        } catch (error) {
            console.error(`Error fetching event from relay ${relay}:`, error);
        }
    }

    console.log('No event found on any relay');
    return null;
};

const fetchCalendarEvents = async (calendarId, naddr) => {
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

        const events = await fetchEvents(eventReferences);
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
};

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
        if (event) events.push(event);
    }
    return events;
};

const publishEventToNostr = async (eventDetails) => {
    console.log('Publishing event to Nostr:', eventDetails);
    const privateKey = process.env.BOT_NSEC;
    if (!privateKey) {
        throw new Error('BOT_NSEC is not set in the environment variables');
    }

    const calendarNaddr = process.env.EVENT_CALENDAR_NADDR;
    if (!calendarNaddr) {
        throw new Error('EVENT_CALENDAR_NADDR is not set in the environment variables');
    }

    const decoded = nip19.decode(calendarNaddr);
    const calendarFilter = {
        kinds: [31924],
        authors: [decoded.data.pubkey],
        "#d": [decoded.data.identifier],
    };
    const calendarEvent = await fetchEventDirectly(calendarFilter);
    if (!calendarEvent) {
        throw new Error('Calendar event not found');
    }

    const calendarPubkey = calendarEvent.pubkey;
    const eventId = crypto.randomBytes(16).toString('hex');
    let eventTemplate = {
        kind: eventDetails.kind || 31923,
        created_at: Math.floor(Date.now() / 1000),
        pubkey: getPublicKey(privateKey),
        tags: [],
        content: eventDetails.content || '',
    };

    if (eventDetails.kind !== 5) {
        const startTimestamp = Math.floor(new Date(`${eventDetails.date}T${eventDetails.time}`).getTime() / 1000);
        eventTemplate.tags = [
            ['d', eventId],
            ['name', eventDetails.title],
            ['start', startTimestamp.toString()],
            ['start_tzid', "Europe/Zurich"],
            ['location', eventDetails.location],
            ['description', eventDetails.description],
            ['p', calendarPubkey, '', 'host'],
            ['a', calendarNaddr],
        ];
        eventTemplate.content = eventDetails.description;

        if (eventDetails.end_date && eventDetails.end_time) {
            const endTimestamp = Math.floor(new Date(`${eventDetails.end_date}T${eventDetails.end_time}`).getTime() / 1000);
            eventTemplate.tags.push(['end', endTimestamp.toString()]);
        }

        if (eventDetails.image) {
            eventTemplate.tags.push(['image', eventDetails.image]);
        }
    } else {
        eventTemplate.tags = eventDetails.tags || [];
    }

    const signedEvent = finalizeEvent(eventTemplate, privateKey);
    console.log('Created Nostr event:', signedEvent);

    for (const relay of config.DEFAULT_RELAYS) {
        try {
            console.log(`Publishing event to relay: ${relay}`);
            await publishToRelay(relay, signedEvent);
        } catch (error) {
            console.error(`Error publishing event to relay ${relay}:`, error);
        }
    }

    if (eventDetails.kind !== 5) {
        await updateCalendarEvent(signedEvent, privateKey);
    }

    return signedEvent;
};

const publishToRelay = (relay, event) => {
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
};

const updateCalendarEvent = async (newEvent, privateKey) => {
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