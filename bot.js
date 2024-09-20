require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { nip19 } = require('nostr-tools');
const WebSocket = require('ws');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const naddrList = process.env.NADDR_LIST.split(',');
const defaultRelays = process.env.DEFAULT_RELAYS.split(',');

function escapeHTML(text) {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;');
}

async function fetchEventDirectly(filter) {
  for (const relay of defaultRelays) {
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
      return { calendarName: calendarEvent.tags.find(t => t[0] === 'name')?.[1] || 'Unbenannter Kalender', events: [] };
    }

    const eventsFilter = {
      kinds: [31923],
      authors: [pubkey],
      "#d": eventReferences.map(ref => ref.identifier),
    };

    console.log('Fetching events with filter:', eventsFilter);
    const events = await fetchEventsDirectly(eventsFilter);
    console.log(`Fetched ${events.length} events for calendar ${calendarId}`);
    return { calendarName: calendarEvent.tags.find(t => t[0] === 'name')?.[1] || 'Unbenannter Kalender', events, naddr };
  } catch (error) {
    console.error(`Error fetching events for calendar ${calendarId}:`, error);
    return { calendarName: 'Unbekannter Kalender', events: [], naddr };
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

bot.onText(\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Willkommen beim Dezentralschweiz Bot! Verwende /meetups, um bevorstehende Meetups zu sehen.');
});

bot.onText(/\/meetups/, async (msg) => {
  const chatId = msg.chat.id;
  
  console.log('Fetching calendar events...');
  try {
    bot.sendMessage(chatId, 'Hole bevorstehende Meetups, bitte warten...');
    
    let allEvents = [];
    for (const naddr of naddrList) {
      const decoded = nip19.decode(naddr);
      const calendarId = `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`;
      const { calendarName, events } = await fetchCalendarEvents(calendarId, naddr);
      allEvents.push({ calendarName, events, naddr });
    }
    
    if (allEvents.every(cal => cal.events.length === 0)) {
      bot.sendMessage(chatId, 'Keine bevorstehenden Meetups gefunden.');
      return;
    }

    let message = '<b>🗓 Bevorstehende Meetups</b>\n\n';
    
    allEvents.forEach(({ calendarName, events, naddr }) => {
      if (events.length > 0) {
        const calendarUrl = `https://www.flockstr.com/calendar/${naddr}`;
        message += `📅 <a href="${calendarUrl}">${escapeHTML(calendarName)}</a>\n\n`;
        
        const uniqueEvents = events.reduce((acc, event) => {
          const eventId = event.id;
          if (!acc.some(e => e.id === eventId)) {
            acc.push(event);
          }
          return acc;
        }, []);
        
        uniqueEvents.sort((a, b) => {
          const aStart = parseInt(a.tags.find(t => t[0] === 'start')?.[1] || '0');
          const bStart = parseInt(b.tags.find(t => t[0] === 'start')?.[1] || '0');
          return aStart - bStart;
        });
        
        uniqueEvents.forEach((event, index) => {
          const title = escapeHTML(event.tags.find(t => t[0] === 'name')?.[1] || 'Unbenanntes Meetup');
          const start = new Date(parseInt(event.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000);
          const location = escapeHTML(event.tags.find(t => t[0] === 'location')?.[1] || 'Kein Ort angegeben');
          const eventNaddr = nip19.naddrEncode({
            kind: event.kind,
            pubkey: event.pubkey,
            identifier: event.tags.find(t => t[0] === 'd')?.[1] || '',
          });
          const eventUrl = `https://www.flockstr.com/event/${eventNaddr}`;
          
          message += `${index + 1}. 🎉 <a href="${eventUrl}">${title}</a>\n`;
          message += `   🕒 Datum: ${start.toLocaleString('de-CH')}\n`;
          message += `   📍 Ort: ${location}\n\n`;
        });
        
        message += '\n';
      }
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (error) {
    console.error('Error in /meetups command:', error);
    bot.sendMessage(chatId, 'Ein Fehler ist beim Holen der Meetups aufgetreten. Bitte versuche es später erneut.');
  }
});

async function main() {
  console.log('Bot is starting...');
}

main();
