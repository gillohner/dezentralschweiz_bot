const {
  nip19
} = require('nostr-tools');

function escapeHTML(text) {
  return text.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMeetupsMessage(allEvents) {
  let message = '<b>🗓 Bevorstehende Meetups</b>\n\n';

  allEvents.forEach(({
    calendarName,
    events,
    naddr
  }) => {
    if (events.length > 0) {
      const calendarUrl = `https://www.flockstr.com/calendar/${naddr}`;
      message += `📅 <a href="${calendarUrl}">${escapeHTML(calendarName)}</a>\n\n`;

      const uniqueEvents = eventsßß.reduce((acc, event) => {
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

      uniqueEvents.forEach((event, index) => {
        const title = escapeHTML(event.tags.find(t => t[0] === 'name')?. [1] || 'Unbenanntes Meetup');
        const start = new Date(parseInt(event.tags.find(t => t[0] === 'start')?. [1] || '0') * 1000);
        const location = escapeHTML(event.tags.find(t => t[0] === 'location')?. [1] || 'Kein Ort angegeben');
        const eventNaddr = nip19.naddrEncode({
          kind: event.kind,
          pubkey: event.pubkey,
          identifier: event.tags.find(t => t[0] === 'd')?. [1] || '',
        });
        const eventUrl = `https://www.flockstr.com/event/${eventNaddr}`;

        message += `${index + 1}. 🎉 <a href="${eventUrl}">${title}</a>\n`;
        message += `   🕒 Datum: ${start.toLocaleString('de-CH')}\n`;
        message += `   📍 Ort: ${location}\n\n`;
      });

      message += '\n';
    }
  });

  return message;
}

module.exports = {
  escapeHTML,
  formatMeetupsMessage
};