require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const NDK = require('@nostr-dev-kit/ndk').default;
const { nip19 } = require('nostr-tools');
const WebSocket = require('ws');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

const naddrList = [
  'naddr1qqyrjv33x9jk2enxqyxhwumn8ghj7mn0wvhxcmmvqgsp2c6tc2q02wd68met3q8jm098r45nppxejw2rf0eaa7v3ns8k24grqsqqql95ndwg6z',
  // Add more naddrs here
];

const defaultRelays = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  // Add more default relays here
];

const ndk = new NDK({
  explicitRelayUrls: defaultRelays,
});

async function connectToRelays() {
  try {
    await ndk.connect();
    console.log('Connected to relays:', defaultRelays);
    return true;
  } catch (error) {
    console.error('Failed to connect to relays:', error);
    return false;
  }
}

async function fetchCalendarEventDirectly(filter, relayUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl);
    ws.on('open', () => {
      const subscriptionMessage = JSON.stringify(["REQ", "my-sub", filter]);
      ws.send(subscriptionMessage);
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message[0] === 'EVENT' && message[1] === 'my-sub') {
        ws.close();
        resolve(message[2]);
      } else if (message[0] === 'EOSE') {
        ws.close();
        resolve(null);
      }
    });

    ws.on('error', (error) => {
      reject(error);
    });
  });
}

const { setTimeout } = require('timers/promises');

async function fetchCalendarEvents(calendarId) {
    console.log(`Fetching events for calendar: ${calendarId}`);
    const [kind, pubkey, identifier] = calendarId.split(':');
  
    const calendarFilter = {
      kinds: [parseInt(kind)],
      authors: [pubkey],
      "#d": [identifier],
    };
  
    try {
      console.log('Fetching calendar event with filter:', calendarFilter);
      let calendarEvent = await ndk.fetchEvent(calendarFilter);
      
      if (!calendarEvent) {
        console.log('Falling back to direct relay query...');
        for (const relay of defaultRelays) {
          calendarEvent = await fetchCalendarEventDirectly(calendarFilter, relay);
          if (calendarEvent) break;
        }
      }
  
      if (!calendarEvent) {
        throw new Error('Calendar event not found');
      }
  
      console.log('Calendar event found:', calendarEvent);
  
      const eventReferences = calendarEvent.tags
        .filter(tag => tag[0] === 'a')
        .map(tag => {
          const [_, eventReference] = tag;
          const [eventKind, eventPubkey, eventIdentifier] = eventReference.split(':');
          return { kind: parseInt(eventKind), pubkey: eventPubkey, identifier: eventIdentifier };
        });
  
      console.log('Event references:', eventReferences);
  
      if (eventReferences.length === 0) {
        return { calendarName: calendarEvent.tags.find(t => t[0] === 'name')?.[1] || 'Unnamed Calendar', events: [] };
      }
  
      const eventsFilter = {
        kinds: [31923],
        authors: [pubkey], // Use the calendar author's pubkey
        "#d": eventReferences.map(ref => ref.identifier),
      };
  
      console.log('Fetching events with filter:', eventsFilter);
      const fetchPromise = ndk.fetchEvents(eventsFilter);
      const timeoutPromise = setTimeout(10000, null); // 10 seconds timeout
  
      const events = await Promise.race([fetchPromise, timeoutPromise]);
  
      if (!events) {
        console.log('Fetching events timed out, falling back to direct relay query...');
        const directEvents = await fetchEventsDirectly(eventsFilter);
        console.log(`Fetched ${directEvents.length} events directly for calendar ${calendarId}`);
        return { calendarName: calendarEvent.tags.find(t => t[0] === 'name')?.[1] || 'Unnamed Calendar', events: directEvents };
      }
  
      console.log(`Fetched ${events.size} events for calendar ${calendarId}`);
      return { calendarName: calendarEvent.tags.find(t => t[0] === 'name')?.[1] || 'Unnamed Calendar', events: Array.from(events) };
    } catch (error) {
      console.error(`Error fetching events for calendar ${calendarId}:`, error);
      return { calendarName: 'Unknown Calendar', events: [] };
    }
}  

async function fetchEventsDirectly(filter) {
  const events = [];
  for (const relay of defaultRelays) {
    try {
      const ws = new WebSocket(relay);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve();
        }, 10000); // 10 seconds timeout

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

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Use /meetups to see upcoming events from all calendars.');
});

bot.onText(/\/meetups/, async (msg) => {
  const chatId = msg.chat.id;
  
  console.log('Fetching calendar events...');
  try {
    bot.sendMessage(chatId, 'Fetching upcoming events, please wait...');
    
    let allEvents = [];
    for (const naddr of naddrList) {
      const decoded = nip19.decode(naddr);
      const calendarId = `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`;
      const { calendarName, events } = await fetchCalendarEvents(calendarId);
      allEvents.push({ calendarName, events });
    }
    
    if (allEvents.every(cal => cal.events.length === 0)) {
      bot.sendMessage(chatId, 'No upcoming events found in any calendar.');
      return;
    }

    let message = '🗓 *Upcoming Events*\n\n';
    
    allEvents.forEach(({ calendarName, events }) => {
      if (events.length > 0) {
        message += `*${calendarName}*\n\n`;
        
        events.sort((a, b) => {
          const aStart = parseInt(a.tags.find(t => t[0] === 'start')?.[1] || '0');
          const bStart = parseInt(b.tags.find(t => t[0] === 'start')?.[1] || '0');
          return aStart - bStart;
        });
        
        events.forEach((event, index) => {
          const title = event.tags.find(t => t[0] === 'name')?.[1] || 'Untitled Event';
          const start = new Date(parseInt(event.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000);
          const location = event.tags.find(t => t[0] === 'location')?.[1] || 'No location specified';
          
          message += `${index + 1}. 🎉 *${title}*\n`;
          message += `   🕒 Date: ${start.toLocaleString()}\n`;
          message += `   📍 Location: ${location}\n\n`;
        });
        
        message += '\n';
      }
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in /meetups command:', error);
    bot.sendMessage(chatId, 'An error occurred while fetching events. Please try again later.');
  }
});

async function main() {
  console.log('Bot is starting...');
  const connected = await connectToRelays();
  if (connected) {
    console.log('Bot is ready to receive commands.');
  } else {
    console.error('Failed to connect to relays. Bot may not function correctly.');
  }
}

main();
