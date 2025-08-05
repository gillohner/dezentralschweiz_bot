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
  let userIdentifier = userInfo.username
    ? `@${userInfo.username}`
    : `${userInfo.firstName} ${userInfo.lastName}`.trim();
  if (!userIdentifier) {
    userIdentifier = "Unbekannter Benutzer";
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
      const publishedEvent = await publishEventToNostr(eventDetails);
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
    "Lass uns ein neues Event erstellen! Bitte gib den Titel des Events ein:\n\nDu kannst den Vorgang jederzeit mit /cancel abbrechen.",
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
      userStates[chatId].step = "date";
      bot.sendMessage(
        chatId,
        "Super! Nun gib bitte das Datum des Events ein (Format: DD-MM-YYYY):\n\nOder tippe /cancel um abzubrechen.",
        {
          disable_notification: true,
        }
      );
      break;
    case "date":
      if (!isValidDate(text)) {
        bot.sendMessage(
          chatId,
          "Ungültiges Datumsformat. Bitte verwende DD-MM-YYYY:\n\nOder tippe /cancel um abzubrechen.",
          {
            disable_notification: true,
          }
        );
        return;
      }
      userStates[chatId].event.date = text;
      userStates[chatId].step = "time";
      bot.sendMessage(
        chatId,
        "Gib jetzt die Startzeit des Events ein (Format: HH:MM):\n\nOder tippe /cancel um abzubrechen.",
        {
          disable_notification: true,
        }
      );
      break;
    case "time":
      if (!isValidTime(text)) {
        bot.sendMessage(
          chatId,
          "Ungültiges Zeitformat. Bitte verwende HH:MM:\n\nOder tippe /cancel um abzubrechen.",
          {
            disable_notification: true,
          }
        );
        return;
      }
      userStates[chatId].event.time = text;
      userStates[chatId].step = "location";
      bot.sendMessage(
        chatId,
        "Wo findet das Event statt?\n\nOder tippe /cancel um abzubrechen.",
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
        const confirmationMessage = `Ich habe folgende Location gefunden:\n${locationData.display_name}\n\nIst das korrekt?`;
        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "Ja, das ist korrekt",
                callback_data: "confirm_location",
              },
            ],
            [
              {
                text: "Nein, erneut eingeben",
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
          "Ich konnte keine passende Location finden. Bitte versuche es erneut oder gib eine genauere Beschreibung ein:\n\nOder tippe /cancel um abzubrechen.",
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
      if (!isValidDate(text)) {
        bot.sendMessage(
          chatId,
          "Ungültiges Datumsformat. Bitte verwende DD-MM-YYYY:\n\nOder tippe /cancel um abzubrechen.",
          {
            disable_notification: true,
          }
        );
        return;
      }
      userStates[chatId].event.end_date = text;
      userStates[chatId].step = "end_time";
      bot.sendMessage(
        chatId,
        "Gib jetzt die Endzeit des Events ein (Format: HH:MM):\n\nOder tippe /cancel um abzubrechen.",
        {
          disable_notification: true,
        }
      );
      break;
    case "end_time":
      if (!isValidTime(text)) {
        bot.sendMessage(
          chatId,
          "Ungültiges Zeitformat. Bitte verwende HH:MM:\n\nOder tippe /cancel um abzubrechen.",
          {
            disable_notification: true,
          }
        );
        return;
      }
      userStates[chatId].event.end_time = text;
      showOptionalFieldsMenu(bot, chatId);
      break;
    case "image":
      // Handle both text URL and photo message
      if (msg.photo) {
        try {
          // Get the highest resolution photo
          const photo = msg.photo[msg.photo.length - 1];

          bot.sendMessage(chatId, "Bild wird hochgeladen...", {
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

          bot.sendMessage(chatId, "Bild erfolgreich hochgeladen! ✅", {
            disable_notification: true,
          });

          showOptionalFieldsMenu(bot, chatId);
        } catch (error) {
          console.error("Error uploading image:", error);
          bot.sendMessage(
            chatId,
            "Fehler beim Hochladen des Bildes. Bitte versuchen Sie es erneut.",
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
          "Bitte senden Sie ein Bild oder eine Bild-URL:",
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
    "Meetup-Erstellung abgebrochen. Du kannst jederzeit mit /meetup_vorschlagen neu beginnen.",
    {
      disable_notification: true,
    }
  );
};

const showOptionalFieldsMenu = (bot, chatId) => {
  // Check if event is already submitted
  if (userStates[chatId] && userStates[chatId].submitted) {
    bot.sendMessage(
      chatId,
      "Dein Event wurde bereits zur Genehmigung eingereicht. Du kannst mit /meetup_vorschlagen ein neues Event erstellen.",
      {
        disable_notification: true,
      }
    );
    return;
  }

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "Enddatum hinzufügen",
          callback_data: "add_end_date",
        },
      ],
      [
        {
          text: "Bild hochladen (URL oder Foto)",
          callback_data: "add_image",
        },
      ],
      [
        {
          text: "URL hinzufügen",
          callback_data: "add_url",
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
          text: "Abbrechen",
          callback_data: "cancel_creation",
        },
      ],
    ],
  };
  bot.sendMessage(
    chatId,
    "Möchtest du optionale Felder hinzufügen, das Event zur Genehmigung senden oder abbrechen?",
    {
      reply_markup: JSON.stringify(keyboard),
      disable_notification: true,
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
        "Bitte gib das Enddatum des Events ein (Format: DD-MM-YYYY):",
        {
          disable_notification: true,
        }
      );
      break;
    case "image":
      bot.sendMessage(
        chatId,
        "Lade ein Bild hoch oder füge eine Bild-URL hinzu:",
        {
          disable_notification: true,
        }
      );
      break;
    case "url":
      bot.sendMessage(chatId, "Füge eine URL hinzu:", {
        disable_notification: true,
      });
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
  let userIdentifier = userInfo.username
    ? `@${userInfo.username}`
    : `${userInfo.firstName} ${userInfo.lastName}`.trim();
  if (!userIdentifier) {
    userIdentifier = "Unbekannter Benutzer";
  }

  let message = `
Neuer Event-Vorschlag von ${userIdentifier}:
Titel: ${eventDetails.title}
Datum: ${eventDetails.date}
Zeit: ${eventDetails.time}
Ort: ${eventDetails.location}
Beschreibung: ${eventDetails.description}
`;

  if (eventDetails.end_date) message += `Enddatum: ${eventDetails.end_date}\n`;
  if (eventDetails.end_time) message += `Endzeit: ${eventDetails.end_time}\n`;
  if (eventDetails.image) message += `Bild-URL: ${eventDetails.image}\n`;

  message += "\nMöchtest du dieses Event genehmigen?";

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "Genehmigen",
          callback_data: `approve_meetup_${userChatId}`,
        },
        {
          text: "Ablehnen",
          callback_data: `reject_meetup_${userChatId}`,
        },
      ],
    ],
  };

  delete userStates[userChatId].step;

  // Edit the message to remove the buttons and show submission confirmation
  bot.editMessageText(
    "Dein Event wurde zur Genehmigung eingereicht! ✅\n\nWir werden dich benachrichtigen, sobald er überprüft wurde.",
    {
      chat_id: userChatId,
      message_id: msg.message_id,
      disable_notification: true,
    }
  );

  bot.sendMessage(adminChatId, message, {
    reply_markup: JSON.stringify(keyboard),
  });

  // Log the event suggestion
  await logEventAction(bot, "EVENT_SUGGESTED", eventDetails, userIdentifier);

  bot.answerCallbackQuery(callbackQuery.id, {
    text: "Event eingereicht!",
  });
};

const handleConfirmLocation = (bot, callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  const locationData = userStates[chatId].tempLocation.data;

  userStates[chatId].event.location = locationData.display_name;
  userStates[chatId].step = "description";
  bot.sendMessage(
    chatId,
    "Großartig! Zum Schluss, gib bitte eine kurze Beschreibung des Events ein:\n\nOder tippe /cancel um abzubrechen.",
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
    "Okay, bitte gib die Location erneut ein:\n\nOder tippe /cancel um abzubrechen.",
    {
      disable_notification: true,
    }
  );
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
};
