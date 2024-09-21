import {
  nip19
} from 'nostr-tools';

const escapeHTML = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const formatMeetupsMessage = (allEvents) => {
  let message = '<b>🗓 Bevorstehende Meetups</b>\n\n';

  allEvents.forEach(({
    calendarName,
    events,
    naddr
  }) => {
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

      uniqueEvents.forEach((event) => {
        const title = escapeHTML(event.tags.find(t => t[0] === 'name')?. [1] || 'Unbenanntes Meetup');
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
      });

      message += '\n';
    }
  });

  return message;
};

export {
  escapeHTML,
  formatMeetupsMessage
};