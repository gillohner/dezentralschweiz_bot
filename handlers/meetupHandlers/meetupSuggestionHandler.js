// handlers/meetupHandlers/meetupSuggestionHandler.js

import { publishEventToNostr } from "../../utils/nostrUtils.js";
import { nip19 } from "nostr-tools";
import { fetchLocationData } from "../../utils/openstreetmap/nominatim.js";
import config from "../../bot/config.js";
import userStates from "../../userStates.js";
import { deleteMessage } from "../../utils/helpers.js";
import { logEventAction } from "../../utils/logUtils.js";
import { isValidDate, isValidTime } from "../../utils/validators.js";
import { uploadImageToBlossom } from "../../utils/blossomUpload.js";
import { downloadTelegramImage } from "../../utils/helpers.js";

// Function to parse various date/time formats
const parseDateTime = (input) => {
  // Remove extra spaces and normalize
  const cleanInput = input.trim().replace(/\s+/g, " ");

  // Patterns for different formats
  const patterns = [
    /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2})\s+(\d{1,2}):(\d{2})$/, // DD.MM.YY HH:MM
    /^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})\s+(\d{1,2}):(\d{2})$/, // DD.MM.YYYY HH:MM
  ];

  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      const [, day, month, year, hours, minutes] = match;

      // Parse numbers
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      let yearNum = parseInt(year);
      const hoursNum = parseInt(hours);
      const minutesNum = parseInt(minutes);

      // Convert 2-digit year to 4-digit
      if (yearNum < 100) {
        yearNum = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
      }

      // Validate ranges
      if (
        dayNum < 1 ||
        dayNum > 31 ||
        monthNum < 1 ||
        monthNum > 12 ||
        yearNum < 2020 ||
        yearNum > 2100 ||
        hoursNum < 0 ||
        hoursNum > 23 ||
        minutesNum < 0 ||
        minutesNum > 59
      ) {
        return { isValid: false };
      }

      // Create date object and validate it's a real date
      const date = new Date(
        yearNum,
        monthNum - 1,
        dayNum,
        hoursNum,
        minutesNum
      );
      if (
        date.getFullYear() !== yearNum ||
        date.getMonth() !== monthNum - 1 ||
        date.getDate() !== dayNum ||
        date.getHours() !== hoursNum ||
        date.getMinutes() !== minutesNum
      ) {
        return { isValid: false };
      }

      // Check if date is in the future (allow events from 1 hour ago to account for timezone differences)
      const now = new Date();
      now.setHours(now.getHours() - 1);
      if (date <= now) {
        return { isValid: false, error: "past_date" };
      }

      return {
        isValid: true,
        dateString: `${dayNum.toString().padStart(2, "0")}.${monthNum
          .toString()
          .padStart(2, "0")}.${yearNum}`,
        timeString: `${hoursNum.toString().padStart(2, "0")}:${minutesNum
          .toString()
          .padStart(2, "0")}`,
        timestamp: Math.floor(date.getTime() / 1000),
        date: date,
      };
    }
  }

  return { isValid: false };
};

// Add helper function to ensure proper event data for Nostr
const prepareEventForNostr = (eventDetails) => {
  // Convert DD.MM.YYYY format to ISO 8601 YYYY-MM-DD for Nostr events
  const convertToISODate = (dateString) => {
    if (!dateString) return null;

    // Handle DD.MM.YYYY or DD.MM.YY format
    const parts = dateString.split(".");
    if (parts.length === 3) {
      let [day, month, year] = parts;

      // Convert 2-digit year to 4-digit if needed
      if (year.length === 2) {
        const yearNum = parseInt(year);
        year = yearNum < 50 ? "20" + year : "19" + year;
      }

      // Validate the date parts
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      if (
        dayNum < 1 ||
        dayNum > 31 ||
        monthNum < 1 ||
        monthNum > 12 ||
        yearNum < 1900 ||
        yearNum > 2100
      ) {
        console.error("Invalid date parts:", {
          day: dayNum,
          month: monthNum,
          year: yearNum,
        });
        return null;
      }

      // Pad day and month with leading zeros if needed
      day = day.padStart(2, "0");
      month = month.padStart(2, "0");

      // Validate the resulting date is real
      const testDate = new Date(yearNum, monthNum - 1, dayNum);
      if (
        testDate.getFullYear() !== yearNum ||
        testDate.getMonth() !== monthNum - 1 ||
        testDate.getDate() !== dayNum
      ) {
        console.error("Invalid date:", dateString);
        return null;
      }

      return `${year}-${month}-${day}`;
    }

    console.error("Invalid date format:", dateString);
    return null;
  };

  // Ensure we have proper timestamps for Nostr event
  if (!eventDetails.startTimestamp && eventDetails.date && eventDetails.time) {
    const fallbackDateTime = parseDateTime(
      `${eventDetails.date} ${eventDetails.time}`
    );
    if (fallbackDateTime.isValid) {
      eventDetails.startTimestamp = fallbackDateTime.timestamp;
    }
  }

  if (
    eventDetails.end_date &&
    eventDetails.end_time &&
    !eventDetails.endTimestamp
  ) {
    const fallbackEndDateTime = parseDateTime(
      `${eventDetails.end_date} ${eventDetails.end_time}`
    );
    if (fallbackEndDateTime.isValid) {
      eventDetails.endTimestamp = fallbackEndDateTime.timestamp;
    }
  }

  // Convert dates to ISO format for Nostr compatibility
  if (eventDetails.date) {
    eventDetails.isoStartDate = convertToISODate(eventDetails.date);
    console.log(
      "Converted start date:",
      eventDetails.date,
      "->",
      eventDetails.isoStartDate
    );
  }

  if (eventDetails.end_date) {
    eventDetails.isoEndDate = convertToISODate(eventDetails.end_date);
    console.log(
      "Converted end date:",
      eventDetails.end_date,
      "->",
      eventDetails.isoEndDate
    );
  }

  return eventDetails;
};

// Clean up old user states to prevent memory leaks and data contamination
const cleanupOldUserStates = () => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  Object.keys(userStates).forEach((chatId) => {
    const userState = userStates[chatId];
    if (userState && userState.createdAt) {
      if (now - userState.createdAt > maxAge) {
        console.log(`Cleaning up old user state for chatId: ${chatId}`);
        delete userStates[chatId];
      }
    }
  });
};

// Run cleanup every hour
setInterval(cleanupOldUserStates, 60 * 60 * 1000);

// Track processed admin actions to prevent duplicate processing
const processedAdminActions = new Set();

// Clean up old processed actions every hour
const cleanupProcessedActions = () => {
  processedAdminActions.clear();
  console.log("Cleared processed admin actions cache");
};

setInterval(cleanupProcessedActions, 60 * 60 * 1000);

const handleMeetupSuggestion = (bot, msg) => {
  if (msg.chat.type !== "private") {
    bot.sendMessage(
      msg.chat.id,
      "Dieser Befehl funktioniert nur in privaten Nachrichten. Bitte sende mir eine direkte Nachricht, um ein Meetup vorzuschlagen.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Zum Bot",
                url: `https://t.me/${bot.username}`,
              },
            ],
          ],
        },
        disable_notification: true,
      }
    );
    return;
  }
  const chatId = msg.chat.id;
  // Completely reset user state to prevent old data interference
  delete userStates[chatId];
  startEventSuggestion(bot, chatId, msg);
};

const handleAdminMeetupSuggestionApproval = async (bot, callbackQuery) => {
  const action = callbackQuery.data;
  const userChatId = action.split("_")[2];
  const isApproved = action.startsWith("approve_meetup_");

  // Create unique action ID to prevent duplicate processing
  const actionId = `${action}_${userChatId}_${callbackQuery.message.message_id}`;

  // Check if this action has already been processed
  if (processedAdminActions.has(actionId)) {
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Diese Aktion wurde bereits verarbeitet!",
      show_alert: true,
    });
    return;
  }

  // Mark action as processed immediately
  processedAdminActions.add(actionId);

  console.log(
    `Event ${isApproved ? "approved" : "rejected"} for user ${userChatId}`
  );

  // Check if user state still exists (might have been processed already)
  if (!userStates[userChatId] || !userStates[userChatId].event) {
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Event wurde bereits verarbeitet oder ist nicht mehr verfügbar!",
      show_alert: true,
    });
    deleteMessage(bot, config.ADMIN_CHAT_ID, callbackQuery.message.message_id);
    return;
  }

  const eventDetails = userStates[userChatId]?.event;
  const userInfo = userStates[userChatId];

  // Check if anonymous mode is enabled
  let userIdentifier;
  if (userStates[userChatId]?.anonymous) {
    userIdentifier = "Anonymer Benutzer";
  } else {
    userIdentifier = userInfo.username
      ? `@${userInfo.username}`
      : `${userInfo.firstName} ${userInfo.lastName}`.trim();
    if (!userIdentifier) {
      userIdentifier = "Unbekannter Benutzer";
    }
  }

  if (isApproved) {
    if (!eventDetails) {
      console.error("No pending event found for user", userChatId);
      bot.sendMessage(
        userChatId,
        "Es gab einen Fehler bei der Verarbeitung deines Events. Bitte versuche es erneut."
      );
      return;
    }

    try {
      // Prepare event data with proper timestamps
      const preparedEventDetails = prepareEventForNostr(eventDetails);

      // Validate that we have proper ISO dates for Nostr
      if (!preparedEventDetails.isoStartDate) {
        console.error(
          "Failed to convert start date to ISO format:",
          eventDetails.date
        );
        bot.sendMessage(
          userChatId,
          "Es gab einen Fehler beim Verarbeiten des Datums. Bitte kontaktiere den Administrator."
        );
        return;
      }

      console.log("Publishing event with ISO dates:", {
        start: preparedEventDetails.isoStartDate,
        end: preparedEventDetails.isoEndDate,
        startTimestamp: preparedEventDetails.startTimestamp,
        endTimestamp: preparedEventDetails.endTimestamp,
      });

      const publishedEvent = await publishEventToNostr(preparedEventDetails);
      console.log("Event published to Nostr:", publishedEvent);

      const eventNaddr = nip19.naddrEncode({
        kind: publishedEvent.kind,
        pubkey: publishedEvent.pubkey,
        identifier: publishedEvent.tags.find((t) => t[0] === "d")?.[1] || "",
      });
      const meetstrLink = `https://meetstr.com/event/${eventNaddr}`;

      bot.sendMessage(
        userChatId,
        `Dein Event wurde genehmigt und veröffentlicht! Hier ist der Link zu deinem Event auf Meetstr: ${meetstrLink}`
      );

      // Log the event approval
      await logEventAction(
        bot,
        "EVENT_APPROVED",
        eventDetails,
        userIdentifier,
        `Veröffentlicht auf Meetstr: ${meetstrLink}`
      );
    } catch (error) {
      console.error("Error publishing event to Nostr:", error);
      bot.sendMessage(
        userChatId,
        "Dein Event wurde genehmigt, konnte aber nicht veröffentlicht werden. Bitte kontaktiere den Administrator."
      );

      // Log the event approval even if publishing failed
      await logEventAction(
        bot,
        "EVENT_APPROVED",
        eventDetails,
        userIdentifier,
        "Fehler beim Veröffentlichen auf Nostr"
      );
    }
  } else {
    bot.sendMessage(
      userChatId,
      "Dein Event-Vorschlag wurde leider nicht genehmigt. Du kannst gerne einen neuen Vorschlag einreichen."
    );

    // Log the event rejection
    await logEventAction(bot, "EVENT_REJECTED", eventDetails, userIdentifier);
  }

  // Clean up user state after processing
  delete userStates[userChatId];

  bot.answerCallbackQuery(callbackQuery.id, {
    text: isApproved ? "Event genehmigt" : "Event abgelehnt",
  });
  deleteMessage(bot, config.ADMIN_CHAT_ID, callbackQuery.message.message_id);
};

const startEventSuggestion = (bot, chatId, msg) => {
  userStates[chatId] = {
    step: "title",
    username: msg.from.username || "",
    firstName: msg.from.first_name || "",
    lastName: msg.from.last_name || "",
    event: {},
    createdAt: Date.now(), // Add timestamp for cleanup
  };
  bot.sendMessage(
    chatId,
    "🎉 Lass uns ein neues Event erstellen! Bitte gib den Titel des Events ein:\n\n⚠️ Du kannst den Vorgang jederzeit mit /cancel abbrechen.",
    {
      disable_notification: true,
    }
  );
};

const handleEventCreationStep = async (bot, msg) => {
  const chatId = msg.chat.id;
  if (!userStates[chatId]) return;

  const { step } = userStates[chatId];
  const text = msg.text;

  if (text && text.startsWith("/")) {
    return handleCancellation(bot, chatId);
  }

  switch (step) {
    case "title":
      const username = msg.chat.username;
      userStates[chatId].event.tg_user_link = `https://t.me/${username}`;

      userStates[chatId].event.title = text;
      userStates[chatId].step = "datetime";
      bot.sendMessage(
        chatId,
        "📅 Super! Nun gib bitte Datum und Startzeit des Events ein.\n\nUnterstützte Formate:\n• DD.MM.YY HH:MM (z.B. 25.12.24 18:30)\n• DD.MM.YYYY HH:MM (z.B. 25.12.2024 18:30)\n• DD-MM-YY HH:MM (z.B. 25-12-24 18:30)\n• DD-MM-YYYY HH:MM (z.B. 25-12-2024 18:30)\n\n⚠️ Oder tippe /cancel um abzubrechen.",
        {
          disable_notification: true,
        }
      );
      break;
    case "datetime":
      const parsedDateTime = parseDateTime(text);

      if (!parsedDateTime.isValid) {
        let errorMsg =
          "❌ Ungültiges Format. Bitte verwende eines der folgenden Formate:\n• DD.MM.YY HH:MM (z.B. 25.12.24 18:30)\n• DD.MM.YYYY HH:MM (z.B. 25.12.2024 18:30)\n• DD-MM-YY HH:MM (z.B. 25-12-24 18:30)\n• DD-MM-YYYY HH:MM (z.B. 25-12-2024 18:30)";

        if (parsedDateTime.error === "past_date") {
          errorMsg =
            "❌ Das Datum liegt in der Vergangenheit. Bitte gib ein zukünftiges Datum ein.";
        }

        bot.sendMessage(
          chatId,
          errorMsg + "\n\n⚠️ Oder tippe /cancel um abzubrechen.",
          {
            disable_notification: true,
          }
        );
        return;
      }

      userStates[chatId].event.date = parsedDateTime.dateString;
      userStates[chatId].event.time = parsedDateTime.timeString;
      userStates[chatId].event.startTimestamp = parsedDateTime.timestamp;
      userStates[chatId].step = "location";
      bot.sendMessage(
        chatId,
        "📍 Perfekt! Wo findet das Event statt? (Adresse, Ort oder Veranstaltungsname):\n\n⚠️ Oder tippe /cancel um abzubrechen.",
        {
          disable_notification: true,
        }
      );
      break;
    case "location":
      const locationData = await fetchLocationData(text);
      if (locationData) {
        userStates[chatId].tempLocation = {
          input: text,
          data: locationData,
        };
        const confirmationMessage = `📍 Ich habe folgende Location gefunden:\n\n${locationData.display_name}\n\n✅ Ist das korrekt?`;
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "✅ Ja, das ist korrekt",
                callback_data: "confirm_location",
              },
            ],
            [
              {
                text: "🔄 Nein, erneut eingeben",
                callback_data: "retry_location",
              },
            ],
          ],
        };
        bot.sendMessage(chatId, confirmationMessage, {
          reply_markup: JSON.stringify(keyboard),
          disable_notification: true,
        });
      } else {
        bot.sendMessage(
          chatId,
          "❌ Ich konnte keine passende Location finden. Bitte versuche es erneut oder gib eine genauere Beschreibung ein:\n\n⚠️ Oder tippe /cancel um abzubrechen.",
          {
            disable_notification: true,
          }
        );
      }
      break;
    case "description":
      userStates[chatId].event.description = text;
      showOptionalFieldsMenu(bot, chatId);
      break;
    case "end_date":
      const parsedEndDateTime = parseDateTime(text);

      if (!parsedEndDateTime.isValid) {
        let errorMsg =
          "❌ Ungültiges Format. Bitte verwende eines der folgenden Formate:\n• DD.MM.YY HH:MM (z.B. 25.12.24 20:00)\n• DD.MM.YYYY HH:MM (z.B. 25.12.2024 20:00)\n• DD-MM-YY HH:MM (z.B. 25-12-24 20:00)\n• DD-MM-YYYY HH:MM (z.B. 25-12-2024 20:00)";

        if (parsedEndDateTime.error === "past_date") {
          errorMsg =
            "❌ Das Enddatum liegt in der Vergangenheit. Bitte gib ein zukünftiges Datum ein.";
        }

        bot.sendMessage(
          chatId,
          errorMsg + "\n\n⚠️ Oder tippe /cancel um abzubrechen.",
          {
            disable_notification: true,
          }
        );
        return;
      }

      // Check if end date is after start date
      if (
        userStates[chatId].event.startTimestamp &&
        parsedEndDateTime.timestamp <= userStates[chatId].event.startTimestamp
      ) {
        bot.sendMessage(
          chatId,
          "❌ Das Enddatum muss nach dem Startdatum liegen. Bitte gib ein späteres Datum ein.\n\n⚠️ Oder tippe /cancel um abzubrechen.",
          {
            disable_notification: true,
          }
        );
        return;
      }

      userStates[chatId].event.end_date = parsedEndDateTime.dateString;
      userStates[chatId].event.end_time = parsedEndDateTime.timeString;
      userStates[chatId].event.endTimestamp = parsedEndDateTime.timestamp;
      showOptionalFieldsMenu(bot, chatId);
      break;
    case "image":
      // Handle both text URL and photo message
      if (msg.photo) {
        try {
          // Get the highest resolution photo
          const photo = msg.photo[msg.photo.length - 1];

          bot.sendMessage(chatId, "🖼️ Bild wird hochgeladen...", {
            disable_notification: true,
          });

          // Download image from Telegram
          const { buffer, mimeType } = await downloadTelegramImage(
            bot,
            photo.file_id
          );

          // Upload to Blossom
          const blossomUrl = await uploadImageToBlossom(buffer, mimeType);

          userStates[chatId].event.image = blossomUrl;

          bot.sendMessage(chatId, "✅ Bild erfolgreich hochgeladen!", {
            disable_notification: true,
          });

          showOptionalFieldsMenu(bot, chatId);
        } catch (error) {
          console.error("Error uploading image:", error);
          bot.sendMessage(
            chatId,
            "❌ Fehler beim Hochladen des Bildes. Bitte versuche es erneut.",
            {
              disable_notification: true,
            }
          );
        }
      } else if (text) {
        // Fallback for URL input
        userStates[chatId].event.image = text;
        showOptionalFieldsMenu(bot, chatId);
      } else {
        bot.sendMessage(
          chatId,
          "🖼️ Bitte sende ein Bild oder gib eine Bild-URL ein:\n\n⚠️ Oder tippe /cancel um abzubrechen.",
          {
            disable_notification: true,
          }
        );
      }
      break;
    case "url":
      userStates[chatId].event.url = text;
      showOptionalFieldsMenu(bot, chatId);
      break;
  }
};

const handleCancellation = (bot, chatId) => {
  delete userStates[chatId];
  bot.sendMessage(
    chatId,
    "❌ Meetup-Erstellung abgebrochen. Du kannst jederzeit mit /meetup_vorschlagen neu beginnen.",
    {
      disable_notification: true,
    }
  );
};

const showOptionalFieldsMenu = (bot, chatId) => {
  // Check if event is already submitted
  if (userStates[chatId] && userStates[chatId].submitted) {
    return;
  }

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "📅 Enddatum hinzufügen",
          callback_data: "add_end_date",
        },
      ],
      [
        {
          text: "🖼️ Bild hochladen (URL oder Foto)",
          callback_data: "add_image",
        },
      ],
      [
        {
          text: "🔗 URL hinzufügen",
          callback_data: "add_url",
        },
      ],
      [
        {
          text: userStates[chatId]?.anonymous
            ? "🔓 Nicht anonym (Telegram-Name zeigen)"
            : "🔒 Anonym (Telegram-Name verstecken)",
          callback_data: "toggle_anonymous",
        },
      ],
      [
        {
          text: "🚀 Zur Genehmigung senden",
          callback_data: "send_for_approval",
        },
      ],
      [
        {
          text: "❌ Abbrechen",
          callback_data: "cancel_creation",
        },
      ],
    ],
  };
  bot.sendMessage(
    chatId,
    `✨ Möchtest du optionale Felder hinzufügen, das Event zur Genehmigung senden oder abbrechen?\n\n${
      userStates[chatId]?.anonymous
        ? "🔒 <b>Anonymer Modus aktiviert</b> - Dein Telegram-Name wird nicht angezeigt"
        : "🔓 <b>Öffentlicher Modus</b> - Dein Telegram-Name wird angezeigt"
    }`,
    {
      reply_markup: JSON.stringify(keyboard),
      disable_notification: true,
      parse_mode: "HTML",
    }
  );
};

const handleOptionalField = (bot, chatId, field) => {
  // Ensure we have a valid user state
  if (!userStates[chatId] || !userStates[chatId].event) {
    bot.sendMessage(
      chatId,
      "Deine Session ist abgelaufen. Bitte starte mit /meetup_vorschlagen neu.",
      {
        disable_notification: true,
      }
    );
    return;
  }

  // Check if already submitted
  if (userStates[chatId].submitted) {
    bot.sendMessage(
      chatId,
      "Dein Event wurde bereits zur Genehmigung eingereicht. Du kannst mit /meetup_vorschlagen ein neues Event erstellen.",
      {
        disable_notification: true,
      }
    );
    return;
  }

  userStates[chatId].step = field;
  switch (field) {
    case "end_date":
      bot.sendMessage(
        chatId,
        "📅 Bitte gib das Enddatum und die Endzeit des Events ein.\n\nUnterstützte Formate:\n• DD.MM.YY HH:MM (z.B. 25.12.24 20:00)\n• DD.MM.YYYY HH:MM (z.B. 25.12.2024 20:00)\n• DD-MM-YY HH:MM (z.B. 25-12-24 20:00)\n• DD-MM-YYYY HH:MM (z.B. 25-12-2024 20:00)\n\n⚠️ Oder tippe /cancel um abzubrechen.",
        {
          disable_notification: true,
        }
      );
      break;
    case "image":
      bot.sendMessage(
        chatId,
        "🖼️ Lade ein Bild hoch oder füge eine Bild-URL hinzu:\n\n⚠️ Oder tippe /cancel um abzubrechen.",
        {
          disable_notification: true,
        }
      );
      break;
    case "url":
      bot.sendMessage(
        chatId,
        "🔗 Füge eine URL hinzu (z.B. zur Anmeldung oder für weitere Infos):\n\n⚠️ Oder tippe /cancel um abzubrechen.",
        {
          disable_notification: true,
        }
      );
      break;
  }
};

const sendEventForApproval = async (bot, callbackQuery, userChatId) => {
  const msg = callbackQuery.message;
  const eventDetails = userStates[userChatId]?.event;

  // Check if already submitted
  if (userStates[userChatId] && userStates[userChatId].submitted) {
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Event wurde bereits eingereicht!",
      show_alert: true,
    });
    return;
  }

  if (!eventDetails) {
    bot.sendMessage(
      userChatId,
      "Es tut mir leid, aber ich habe keine Informationen über dein Event. Bitte starte den Prozess erneut mit /meetup_vorschlagen.",
      {
        disable_notification: true,
      }
    );
    return;
  }

  // Mark as submitted immediately to prevent duplicate submissions
  userStates[userChatId].submitted = true;

  const adminChatId = config.ADMIN_CHAT_ID;
  const userInfo = userStates[userChatId];

  // Check if anonymous mode is enabled
  let userIdentifier;
  let adminUserIdentifier; // For admin view
  if (userStates[userChatId]?.anonymous) {
    userIdentifier = "Anonymer Benutzer";
    // Show real user to admin for moderation purposes
    adminUserIdentifier = userInfo.username
      ? `@${userInfo.username} (anonym)`
      : `${userInfo.firstName} ${userInfo.lastName}`.trim() + " (anonym)";
  } else {
    userIdentifier = userInfo.username
      ? `@${userInfo.username}`
      : `${userInfo.firstName} ${userInfo.lastName}`.trim();
    adminUserIdentifier = userIdentifier;
  }

  if (!adminUserIdentifier) {
    adminUserIdentifier = "Unbekannter Benutzer";
  }

  let message = `
🎉 <b>Neuer Event-Vorschlag</b>

👤 <b>Ersteller:</b> ${adminUserIdentifier}
📝 <b>Titel:</b> ${eventDetails.title}
📅 <b>Datum:</b> ${eventDetails.date}
🕐 <b>Zeit:</b> ${eventDetails.time}
📍 <b>Ort:</b> ${eventDetails.location}
📄 <b>Beschreibung:</b> ${eventDetails.description}
`;

  if (eventDetails.end_date)
    message += `📅 <b>Enddatum:</b> ${eventDetails.end_date}\n`;
  if (eventDetails.end_time)
    message += `🕐 <b>Endzeit:</b> ${eventDetails.end_time}\n`;
  if (eventDetails.image)
    message += `🖼️ <b>Bild-URL:</b> ${eventDetails.image}\n`;
  if (eventDetails.url) message += `🔗 <b>URL:</b> ${eventDetails.url}\n`;

  message += "\n❓ <b>Möchtest du dieses Event genehmigen?</b>";

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "✅ Genehmigen",
          callback_data: `approve_meetup_${userChatId}`,
        },
        {
          text: "❌ Ablehnen",
          callback_data: `reject_meetup_${userChatId}`,
        },
      ],
    ],
  };

  delete userStates[userChatId].step;

  // Edit the message to remove the buttons and show submission confirmation
  bot.editMessageText(
    "✅ Dein Event wurde zur Genehmigung eingereicht! 🎉\n\nWir werden dich benachrichtigen, sobald es überprüft wurde.",
    {
      chat_id: userChatId,
      message_id: msg.message_id,
      disable_notification: true,
    }
  );

  bot.sendMessage(adminChatId, message, {
    reply_markup: JSON.stringify(keyboard),
    parse_mode: "HTML",
  });

  // Log the event suggestion
  await logEventAction(bot, "EVENT_SUGGESTED", eventDetails, userIdentifier);

  bot.answerCallbackQuery(callbackQuery.id, {
    text: "Event eingereicht!",
  });
};

// NOTE: The publishEventToNostr function should use:
// - eventDetails.isoStartDate for the "start" tag (YYYY-MM-DD format)
// - eventDetails.isoEndDate for the "end" tag (YYYY-MM-DD format) if present
// - eventDetails.startTimestamp for time-based events (Unix timestamp)
// - eventDetails.endTimestamp for time-based events (Unix timestamp) if present
//
// For NIP-52 calendar events:
// - Date-based events (kind 31922) use "start" and "end" tags with YYYY-MM-DD format
// - Time-based events (kind 31923) use "start" and "end" tags with Unix timestamps
//
// The user-friendly display dates (eventDetails.date, eventDetails.time) should be
// kept for display purposes but not used in the Nostr event tags

const handleConfirmLocation = (bot, callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  // Handle both old and new tempLocation structure
  const locationData =
    userStates[chatId].tempLocation?.data || userStates[chatId].tempLocation;

  userStates[chatId].event.location = locationData.display_name;
  userStates[chatId].step = "description";
  bot.sendMessage(
    chatId,
    "📝 Großartig! Zum Schluss, gib bitte eine kurze Beschreibung des Events ein:\n\n⚠️ Oder tippe /cancel um abzubrechen.",
    {
      disable_notification: true,
    }
  );
};

const handleRetryLocation = (bot, callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  userStates[chatId].step = "location";
  bot.sendMessage(
    chatId,
    "📍 Okay, bitte gib die Location erneut ein:\n\n⚠️ Oder tippe /cancel um abzubrechen.",
    {
      disable_notification: true,
    }
  );
};

const handleToggleAnonymous = (bot, callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  // Toggle anonymous mode
  if (!userStates[chatId]) {
    userStates[chatId] = {};
  }
  userStates[chatId].anonymous = !userStates[chatId].anonymous;

  // Update the message with new button state
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "📅 Enddatum hinzufügen",
          callback_data: "add_end_date",
        },
      ],
      [
        {
          text: "🖼️ Bild hochladen (URL oder Foto)",
          callback_data: "add_image",
        },
      ],
      [
        {
          text: "🔗 URL hinzufügen",
          callback_data: "add_url",
        },
      ],
      [
        {
          text: userStates[chatId]?.anonymous
            ? "🔓 Nicht anonym (Telegram-Name zeigen)"
            : "🔒 Anonym (Telegram-Name verstecken)",
          callback_data: "toggle_anonymous",
        },
      ],
      [
        {
          text: "🚀 Zur Genehmigung senden",
          callback_data: "send_for_approval",
        },
      ],
      [
        {
          text: "❌ Abbrechen",
          callback_data: "cancel_creation",
        },
      ],
    ],
  };

  bot.editMessageText(
    `✨ Möchtest du optionale Felder hinzufügen, das Event zur Genehmigung senden oder abbrechen?\n\n${
      userStates[chatId]?.anonymous
        ? "🔒 <b>Anonymer Modus aktiviert</b> - Dein Telegram-Name wird nicht angezeigt"
        : "🔓 <b>Öffentlicher Modus</b> - Dein Telegram-Name wird angezeigt"
    }`,
    {
      chat_id: chatId,
      message_id: msg.message_id,
      reply_markup: JSON.stringify(keyboard),
      parse_mode: "HTML",
    }
  );

  bot.answerCallbackQuery(callbackQuery.id, {
    text: userStates[chatId].anonymous
      ? "Anonymer Modus aktiviert"
      : "Öffentlicher Modus aktiviert",
  });
};

export {
  handleMeetupSuggestion,
  handleAdminMeetupSuggestionApproval,
  startEventSuggestion,
  handleEventCreationStep,
  handleOptionalField,
  sendEventForApproval,
  handleCancellation,
  handleConfirmLocation,
  handleRetryLocation,
  handleToggleAnonymous,
  prepareEventForNostr,
};
