import {
  nip19
} from 'nostr-tools';
import {
  checkForDeletionEvent
} from './nostrUtils.js';

const escapeHTML = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const formatMeetupsMessage = async (allEvents, timeFrame) => {
  let headerMessage;
  switch (timeFrame) {
    case 'today':
      headerMessage = '🗓 Meetups heute';
      break;
    case 'week':
      headerMessage = '🗓 Meetups diese Woche';
      break;
    case 'month':
      headerMessage = '🗓 Meetups diesen Monat';
      break;
    default:
      headerMessage = '🗓 Alle bevorstehenden Meetups';
  }

  let message = `<b>${headerMessage}</b>\n\n`;

  for (const {
      calendarName,
      events,
      naddr
    } of allEvents) {
    if (events.length > 0) {
      const calendarUrl = `https://www.flockstr.com/calendar/${naddr}`;
      message += `<b>📅 <a href="${calendarUrl}">${escapeHTML(calendarName)}</a></b>\n\n`;

      const uniqueEvents = events.reduce((acc, event) => {
        const eventId = event.id;
        if (!acc.some(e => e.id === eventId)) {
          acc.push(event);
        }
        return acc;
      }, []);

      uniqueEvents.sort((a, b) => {
        const aStart = parseInt(a.tags.find(t => t[0] === 'start')?. [1] || '0');
        const bStart = parseInt(b.tags.find(t => t[0] === 'start')?. [1] || '0');
        return aStart - bStart;
      });

      for (const event of uniqueEvents) {
        // Check for deletion event
        const isDeleted = await checkForDeletionEvent(event.id);
        if (isDeleted) {
          console.log(`Event ${event.id} has been deleted. Skipping.`);
          continue; // Skip this event if it has been deleted
        }

        const title = escapeHTML(event.tags.find(t => t[0] === 'name')?. [1] || event.tags.find(t => t[0] === 'title')?. [1] || 'Unbenanntes Meetup');
        const start = new Date(parseInt(event.tags.find(t => t[0] === 'start')?. [1] || '0') * 1000);
        const location = escapeHTML(event.tags.find(t => t[0] === 'location')?. [1] || 'Kein Ort angegeben');
        const eventNaddr = nip19.naddrEncode({
          kind: event.kind,
          pubkey: event.pubkey,
          identifier: event.tags.find(t => t[0] === 'd')?. [1] || '',
        });
        const eventUrl = `https://www.flockstr.com/event/${eventNaddr}`;

        message += `<b>   🎉 <a href="${eventUrl}">${title}</a></b>\n`;
        message += `   🕒 <i>Datum:</i> ${start.toLocaleString('de-CH')}\n`;
        message += `   📍 <i>Ort:</i> ${location}\n\n`;
      }

      message += '\n';
    }
  }

  return message;
};

export {
  escapeHTML,
  formatMeetupsMessage
};