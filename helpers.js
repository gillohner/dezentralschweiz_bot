const escapeHTML = (text) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const extractTelegramUsername = (tags) => {
  const rTag = tags.find(t => t[0] === 'r' && t[1].startsWith('https://t.me/'));
  if (rTag) {
    const username = rTag[1].split('/').pop();
    return `@${username}`;
  }
  return null;
};

const formatLocation = (location, googleMapsLink, osmLink) => {
  const suffix = ', Schweiz/Suisse/Svizzera/Svizra';
  let formattedLocation = location.endsWith(suffix) ? location.slice(0, -suffix.length).trim() : location;

  let result = `📍 ${escapeHTML(formattedLocation)}\n`;
  if (googleMapsLink || osmLink) {
    result += '   ';
    if (googleMapsLink) {
      result += `🌍 <a href="${googleMapsLink}">Google Maps</a>`;
    }
    if (googleMapsLink && osmLink) {
      result += ' | ';
    }
    if (osmLink) {
      result += `🕵️ <a href="${osmLink}">OpenStreetMap</a>`;
    }
    result += '\n';
  }
  return result;
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString('de-CH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export {
  extractTelegramUsername,
  formatLocation,
  formatDate,
  escapeHTML
};