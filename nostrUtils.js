const WebSocket = require('ws');
const config = require('./config');

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

module.exports = {
    fetchCalendarEvents
};