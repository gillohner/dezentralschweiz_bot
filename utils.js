import {
  nip19
} from 'nostr-tools';
import {
  checkForDeletionEvent
} from './nostrUtils.js';
import ngeohash from 'ngeohash';
import {
  extractTelegramUsername,
  formatLocation,
  formatDate,
  escapeHTML
} from './helpers.js'

const getHeaderMessage = (timeFrame) => {
  switch (timeFrame) {
    case 'today':
      return 'Meetups heute';
    case 'week':
      return 'Meetups diese Woche';
    case 'month':
      return 'Meetups diesen Monat';
    default:
      return 'Alle bevorstehenden Meetups';
  }
};

const formatMeetupsMessage = async (allEvents, timeFrame) => {
  let message = `🍻 <b>${getHeaderMessage(timeFrame)}</b>\n\n`;

  for (const { calendarName, events, naddr } of allEvents) {
    if (events.length > 0) {
      const calendarUrl = `https://www.flockstr.com/calendar/${naddr}`;
      message += `<b>📅 <a href="${calendarUrl}">${escapeHTML(calendarName)}</a></b>\n\n`;

      for (const event of events) {
        if (await checkForDeletionEvent(event.id)) continue;

        const title = event.tags.find(t => t[0] === 'name')?.[1] || event.tags.find(t => t[0] === 'title')?.[1];
        if (!title) continue;

        const start = event.tags.find(t => t[0] === 'start')?.[1];
        if (!start) continue;

        const locationTag = event.tags.find(t => t[0] === 'location');
        const location = locationTag ? locationTag[1] : null;

        const eventNaddr = nip19.naddrEncode({
          kind: event.kind,
          pubkey: event.pubkey,
          identifier: event.tags.find(t => t[0] === 'd')?.[1] || '',
        });
        const eventUrl = `https://www.flockstr.com/event/${eventNaddr}`;

        message += `🎉 <b><a href="${eventUrl}">${escapeHTML(title)}</a></b>\n`;
        if (start) message += `🕒 ${formatDate(parseInt(start) * 1000)}\n`;
        
        // Handle Telegram link
        const telegramUser = extractTelegramUsername(event.tags);

        if (telegramUser) {
          message += `👤 <b>Organisator:</b> ${telegramUser}\n`;
        }

        if (location) {
          const googleMapsLink = event.tags.find(t => t[0] === 'r' && t[1].includes('google.com/maps'))?.[1];
          const osmLink = event.tags.find(t => t[0] === 'r' && t[1].includes('openstreetmap.org'))?.[1];
          message += formatLocation(location, googleMapsLink, osmLink);
        }
        
        message += '\n';
      }
    }
  }

  return message;
};

export {
  escapeHTML,
  formatMeetupsMessage
};