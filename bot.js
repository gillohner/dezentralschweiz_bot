require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const NDK = require('@nostr-dev-kit/ndk').default;
const { nip19 } = require('nostr-tools');
const WebSocket = require('ws');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

const naddr = 'naddr1qqyrjv33x9jk2enxqyxhwumn8ghj7mn0wvhxcmmvqgsp2c6tc2q02wd68met3q8jm098r45nppxejw2rf0eaa7v3ns8k24grqsqqql95ndwg6z';
const decoded = nip19.decode(naddr);
console.log('Decoded naddr:', decoded);

const calendarId = `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`;
const relayUrl = decoded.data.relays[0];

const ndk = new NDK({
  explicitRelayUrls: [relayUrl],
});

async function connectToRelay() {
  try {
    await ndk.connect();
    console.log('Connected to relay:', relayUrl);
    return true;
  } catch (error) {
    console.error('Failed to connect to relay:', error);
    return false;
  }
}

async function fetchCalendarEventDirectly(filter) {
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
      calendarEvent = await fetchCalendarEventDirectly(calendarFilter);
    }

    if (!calendarEvent) {
      throw new Error('Calendar event not found');
    }

    console.log('Calendar event found:', calendarEvent);

    const eventReferences = calendarEvent.tags
      .filter(tag => tag[0] === 'a')
      .map(tag => tag[1]);

    console.log('Event references:', eventReferences);

    if (eventReferences.length === 0) {
      return [];
    }

    const eventsFilter = {
      kinds: [31923],
      "#a": eventReferences,
    };

    console.log('Fetching events with filter:', eventsFilter);
    const events = await ndk.fetchEvents(eventsFilter);
    console.log(`Fetched ${events.size} events for calendar ${calendarId}`);
    return Array.from(events);
  } catch (error) {
    console.error(`Error fetching events for calendar ${calendarId}:`, error);
    return [];
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Use /meetups to see upcoming events.');
});

bot.onText(/\/meetups/, async (msg) => {
  const chatId = msg.chat.id;
  
  console.log('Fetching calendar events...');
  try {
    const events = await fetchCalendarEvents(calendarId);
    
    if (events.length === 0) {
      bot.sendMessage(chatId, 'No upcoming events found.');
      return;
    }

    // Sort events by start time
    events.sort((a, b) => {
      const aStart = parseInt(a.tags.find(t => t[0] === 'start')?.[1] || '0');
      const bStart = parseInt(b.tags.find(t => t[0] === 'start')?.[1] || '0');
      return aStart - bStart;
    });
    
    let message = 'Upcoming Events:\n\n';
    
    events.forEach((event, index) => {
      const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Untitled Event';
      const start = new Date(parseInt(event.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000);
      const location = event.tags.find(t => t[0] === 'location')?.[1] || 'No location specified';
      
      message += `${index + 1}. ${title}\n`;
      message += `   Date: ${start.toLocaleString()}\n`;
      message += `   Location: ${location}\n\n`;
    });
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in /meetups command:', error);
    bot.sendMessage(chatId, 'An error occurred while fetching events. Please try again later.');
  }
});

async function main() {
  console.log('Bot is starting...');
  const connected = await connectToRelay();
  if (connected) {
    console.log('Bot is ready to receive commands.');
  } else {
    console.error('Failed to connect to relay. Bot may not function correctly.');
  }
}

main();
