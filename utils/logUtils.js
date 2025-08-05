// utils/logUtils.js
import config from "../bot/config.js";

/**
 * Logs an event action to the logs channel
 * @param {Object} bot - The Telegram bot instance
 * @param {string} action - The action type (e.g., 'EVENT_CREATED', 'EVENT_APPROVED', 'EVENT_REJECTED', 'EVENT_DELETED')
 * @param {Object} eventDetails - Event details object
 * @param {string} userIdentifier - User identifier (username or name)
 * @param {string} [additionalInfo] - Optional additional information
 */
const logEventAction = async (
  bot,
  action,
  eventDetails,
  userIdentifier,
  additionalInfo = ""
) => {
  const logsChatId = config.LOGS_CHAT_ID;

  if (!logsChatId) {
    console.log("LOGS_CHAT_ID not configured, skipping log message");
    return;
  }

  const timestamp = new Date().toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  let logMessage = "";
  const actionIcon = getActionIcon(action);

  switch (action) {
    case "EVENT_SUGGESTED":
      logMessage = `${actionIcon} **Event vorgeschlagen**
📅 ${timestamp}
👤 **Benutzer:** ${userIdentifier}
📝 **Titel:** ${eventDetails.title}
📅 **Datum:** ${eventDetails.date}
🕐 **Zeit:** ${eventDetails.time}
📍 **Ort:** ${eventDetails.location}
📄 **Beschreibung:** ${eventDetails.description}`;
      if (eventDetails.end_date)
        logMessage += `\n📅 **Enddatum:** ${eventDetails.end_date}`;
      if (eventDetails.end_time)
        logMessage += `\n🕐 **Endzeit:** ${eventDetails.end_time}`;
      if (eventDetails.image)
        logMessage += `\n🖼️ **Bild:** ${eventDetails.image}`;
      if (eventDetails.url) logMessage += `\n🔗 **URL:** ${eventDetails.url}`;
      break;

    case "EVENT_APPROVED":
      logMessage = `${actionIcon} **Event genehmigt**
📅 ${timestamp}
👤 **Genehmigt für:** ${userIdentifier}
📝 **Titel:** ${eventDetails.title}
📅 **Datum:** ${eventDetails.date}
🕐 **Zeit:** ${eventDetails.time}
📍 **Ort:** ${eventDetails.location}`;
      if (additionalInfo) logMessage += `\n📋 **Details:** ${additionalInfo}`;
      break;

    case "EVENT_REJECTED":
      logMessage = `${actionIcon} **Event abgelehnt**
📅 ${timestamp}
👤 **Abgelehnt für:** ${userIdentifier}
📝 **Titel:** ${eventDetails.title}
📅 **Datum:** ${eventDetails.date}
🕐 **Zeit:** ${eventDetails.time}
📍 **Ort:** ${eventDetails.location}`;
      if (additionalInfo) logMessage += `\n📋 **Grund:** ${additionalInfo}`;
      break;

    case "EVENT_DELETION_SUGGESTED":
      logMessage = `${actionIcon} **Event-Löschung vorgeschlagen**
📅 ${timestamp}
👤 **Benutzer:** ${userIdentifier}
📝 **Titel:** ${eventDetails.title || "Ohne Titel"}
📅 **Datum:** ${eventDetails.date || "Unbekannt"}
📍 **Ort:** ${eventDetails.location || "Kein Ort angegeben"}`;
      if (additionalInfo) logMessage += `\n📋 **Event-ID:** ${additionalInfo}`;
      break;

    case "EVENT_DELETION_APPROVED":
      logMessage = `${actionIcon} **Event-Löschung genehmigt**
📅 ${timestamp}
👤 **Genehmigt für:** ${userIdentifier}
📝 **Titel:** ${eventDetails.title || "Ohne Titel"}
📅 **Datum:** ${eventDetails.date || "Unbekannt"}
📍 **Ort:** ${eventDetails.location || "Kein Ort angegeben"}`;
      if (additionalInfo) logMessage += `\n📋 **Event-ID:** ${additionalInfo}`;
      break;

    case "EVENT_DELETION_REJECTED":
      logMessage = `${actionIcon} **Event-Löschung abgelehnt**
📅 ${timestamp}
👤 **Abgelehnt für:** ${userIdentifier}
📝 **Titel:** ${eventDetails.title || "Ohne Titel"}
📅 **Datum:** ${eventDetails.date || "Unbekannt"}
📍 **Ort:** ${eventDetails.location || "Kein Ort angegeben"}`;
      if (additionalInfo) logMessage += `\n📋 **Grund:** ${additionalInfo}`;
      break;

    default:
      logMessage = `${actionIcon} **Unbekannte Aktion: ${action}**
📅 ${timestamp}
👤 **Benutzer:** ${userIdentifier}`;
      break;
  }

  try {
    await bot.sendMessage(logsChatId, logMessage, {
      parse_mode: "Markdown",
      disable_notification: true,
    });
    console.log(`Logged action: ${action} for user: ${userIdentifier}`);
  } catch (error) {
    console.error("Error sending log message:", error);
  }
};

/**
 * Gets the appropriate icon for each action type
 * @param {string} action - The action type
 * @returns {string} - The corresponding emoji icon
 */
const getActionIcon = (action) => {
  const icons = {
    EVENT_SUGGESTED: "📋",
    EVENT_APPROVED: "✅",
    EVENT_REJECTED: "❌",
    EVENT_DELETION_SUGGESTED: "🗑️",
    EVENT_DELETION_APPROVED: "✅🗑️",
    EVENT_DELETION_REJECTED: "❌🗑️",
  };
  return icons[action] || "📝";
};

export { logEventAction };
