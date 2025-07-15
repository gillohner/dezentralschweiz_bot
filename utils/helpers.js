import userStates from "../userStates.js";

const escapeHTML = (text) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const extractTelegramUsername = (tags) => {
  try {
    const rTag = tags.find(
      (t) => t[0] === "r" && t[1].startsWith("https://t.me/")
    );
    if (rTag) {
      const username = rTag[1].split("/").pop();
      return `@${username}`;
    }
    return null;
  } catch (e) {
    console.error("Telegram user extraction failed: ", e);
  }
};

const cleanUrl = (url) => {
  if (!url) return url;

  // Remove empty query parameters
  return url
    .replace(/[?&]([^=]+)=(?=&|$)/g, (match, param) => {
      // Remove the parameter if it's empty
      return "";
    })
    .replace(/[?&]$/, "")
    .replace(/[?]&/, "?");
};

const formatLocation = async (event) => {
  let result = `📍 ${
    event.locationData.formattedName
      ? event.locationData.formattedName
      : event.locationData.formattedAddress
  }`;
  let googleMapsLink = cleanUrl(event.locationData.mapLinks.google);
  let osmLink = cleanUrl(event.locationData.mapLinks.osm);
  let appleMapsLink = cleanUrl(event.locationData.mapLinks.apple);
  let btcMapLink = cleanUrl(event.locationData.mapLinks.btcmap);
  let paymentEmojis = "";

  if (event.locationData.paymentMethods.lightning) paymentEmojis += "⚡";
  if (event.locationData.paymentMethods.contactless) paymentEmojis += "🛜";
  if (event.locationData.paymentMethods.onChain) paymentEmojis += "⛓️";

  if (paymentEmojis) {
    result += ` ${paymentEmojis}`;
  }

  result += "\n";

  if (googleMapsLink || osmLink || appleMapsLink) {
    result += "   ";
    if (googleMapsLink) {
      result += `🌍 <a href="${googleMapsLink}">Google</a>`;
    }

    if (osmLink && (googleMapsLink || appleMapsLink)) {
      result += " | ";
    }
    if (osmLink) {
      result += `🕵️ <a href="${osmLink}">OSM</a>`;
    }

    if (appleMapsLink && (googleMapsLink || osmLink)) {
      result += " | ";
    }
    if (appleMapsLink) {
      result += `🍏 <a href="${appleMapsLink}">Apple</a>`;
    }

    result += "\n";
  }

  return result;
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const deleteMessage = async (bot, chatId, messageId) => {
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (error) {
    console.error("Error deleting message:", error);
  }
};

const deleteMessageWithTimeout = async (
  bot,
  chatId,
  messageId,
  timeout = 5 * 60 * 1000
) => {
  // 5 min. default
  setTimeout(async () => {
    try {
      await bot.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error("Error deleting message:", error, messageId);
    }
  }, timeout);
};

const sendAndStoreMessage = async (
  bot,
  chatId,
  text,
  options,
  userStateKey
) => {
  const sentMessage = await bot.sendMessage(chatId, text, options);
  userStates[chatId] = {
    ...userStates[chatId],
    [userStateKey]: sentMessage.message_id,
  };
  return sentMessage;
};

const editAndStoreMessage = async (
  bot,
  chatId,
  text,
  options,
  userStateKey
) => {
  const sentMessage = await bot.editMessageText(text, options);
  userStates[chatId] = {
    ...userStates[chatId],
    [userStateKey]: sentMessage.message_id,
  };
  return sentMessage;
};

export {
  extractTelegramUsername,
  formatLocation,
  formatDate,
  escapeHTML,
  deleteMessageWithTimeout,
  sendAndStoreMessage,
  deleteMessage,
  editAndStoreMessage,
};
