import { getPublicKey, nip19 } from "nostr-tools";
import {
  publishEventToNostr,
  fetchEventDirectly,
} from "../../utils/nostrUtils.js";
import userStates from "../../userStates.js";
import config from "../../bot/config.js";
import { deleteMessage } from "../../utils/helpers.js";
import { logEventAction } from "../../utils/logUtils.js";

const handleMeetupDeletion = (bot, msg) => {
  if (!isPrivateChat(msg)) {
    sendPrivateMessageRequest(bot, msg);
    return;
  }
  initiateEventDeletion(bot, msg);
};

const isPrivateChat = (msg) => msg.chat.type === "private";

const sendPrivateMessageRequest = (bot, msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Dieser Befehl funktioniert nur in privaten Nachrichten...",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Zum Bot", url: `https://t.me/${bot.username}` }],
        ],
      },
      disable_notification: true,
    }
  );
};

const initiateEventDeletion = (bot, msg) => {
  const chatId = msg.chat.id;
  userStates[chatId] = { step: "awaiting_event_id_for_deletion" };
  bot.sendMessage(
    chatId,
    "Bitte geben Sie die Event-ID oder NADDR des zu löschenden Events ein...",
    {
      disable_notification: true,
    }
  );
};

const pendingApprovals = {};

const handleAdminMeetupDeletionApproval = async (bot, callbackQuery) => {
  const action = callbackQuery.data;
  const adminChatId = callbackQuery.message.chat.id;
  const userChatId = action.split("_")[2];
  const isApproved = action.startsWith("approve_delete_");

  // Check if this approval has already been handled
  if (pendingApprovals[userChatId]) {
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Diese Anfrage wurde bereits bearbeitet.",
    });
    return;
  }

  // Mark as handled immediately
  pendingApprovals[userChatId] = true;
  deleteMessage(bot, adminChatId, callbackQuery.message.message_id);

  console.log(
    `Event deletion ${
      isApproved ? "approved" : "rejected"
    } for user ${userChatId}`
  );

  const eventToDelete = userStates[userChatId]?.eventToDelete;
  let eventDetails = {};
  if (eventToDelete) {
    eventDetails = {
      title:
        eventToDelete.tags.find((t) => t[0] === "name")?.[1] || "Ohne Titel",
      date: new Date(
        parseInt(eventToDelete.tags.find((t) => t[0] === "start")?.[1] || "0") *
          1000
      ).toLocaleDateString("de-CH"),
      location:
        eventToDelete.tags.find((t) => t[0] === "location")?.[1] ||
        "Kein Ort angegeben",
    };
  }

  if (isApproved) {
    try {
      await handleDeletionConfirmation(bot, callbackQuery, eventToDelete);
      bot.sendMessage(
        userChatId,
        "Ihre Anfrage zur Löschung des Events wurde genehmigt. Das Event wurde gelöscht."
      );

      // Log the deletion approval
      await logEventAction(
        bot,
        "EVENT_DELETION_APPROVED",
        eventDetails,
        "Benutzer",
        eventToDelete?.id
      );
    } catch (error) {
      console.error("Error deleting event:", error);
      bot.sendMessage(
        userChatId,
        "Es gab einen Fehler beim Löschen des Events. Bitte kontaktieren Sie den Administrator."
      );

      // Log the deletion approval even if it failed
      await logEventAction(
        bot,
        "EVENT_DELETION_APPROVED",
        eventDetails,
        "Benutzer",
        `Fehler beim Löschen: ${error.message}`
      );
    }
  } else {
    bot.sendMessage(
      userChatId,
      "Ihre Anfrage zur Löschung des Events wurde abgelehnt."
    );

    // Log the deletion rejection
    await logEventAction(
      bot,
      "EVENT_DELETION_REJECTED",
      eventDetails,
      "Benutzer"
    );
  }

  bot.answerCallbackQuery(callbackQuery.id, {
    text: isApproved ? "Löschung genehmigt" : "Löschung abgelehnt",
  });

  // Mark as handled
  pendingApprovals[userChatId] = true;
};

const handleDeletionConfirmation = async (bot, query, eventToDelete) => {
  const privateKey = config.BOT_NSEC;
  if (!privateKey) {
    throw new Error("BOT_NSEC is not set in the environment variables");
  }

  const publicKey = getPublicKey(privateKey);

  const deleteEvent = {
    kind: 5,
    pubkey: publicKey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["e", eventToDelete.id],
      [
        "a",
        `31923:${eventToDelete.pubkey}:${
          eventToDelete.tags.find((t) => t[0] === "d")?.[1]
        }`,
      ],
    ],
    content: "Event von Admin gelöscht",
  };

  try {
    await publishEventToNostr(deleteEvent);
    bot.answerCallbackQuery(query.id, {
      text: "Event erfolgreich gelöscht",
    });
  } catch (error) {
    console.error("Fehler beim Veröffentlichen des Lösch-Events:", error);
    throw error;
  }
};

const handleDeletionInput = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (
    !userStates[chatId] ||
    userStates[chatId].step !== "awaiting_event_id_for_deletion"
  ) {
    return; // Exit if we're not expecting a deletion input
  }

  if (text.toLowerCase() === "/cancel") {
    delete userStates[chatId];
    bot.sendMessage(chatId, "Löschungsvorgang abgebrochen.", {
      disable_notification: true,
    });
    return;
  }

  let filter;
  try {
    const decoded = nip19.decode(text);
    if (decoded.type === "note") {
      filter = {
        ids: [decoded.data],
      };
    } else if (decoded.type === "naddr") {
      filter = {
        kinds: [decoded.data.kind],
        authors: [decoded.data.pubkey],
        "#d": [decoded.data.identifier],
      };
    } else {
      throw new Error("Unsupported Nostr type");
    }
  } catch (error) {
    console.error("Fehler beim Dekodieren von NADDR:", error);
    bot.sendMessage(
      chatId,
      "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut oder geben Sie /cancel ein, um abzubrechen.",
      {
        disable_notification: true,
      }
    );
    return;
  }

  if (!filter) {
    bot.sendMessage(
      chatId,
      "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut oder geben Sie /cancel ein, um abzubrechen.",
      {
        disable_notification: true,
      }
    );
    return;
  }

  console.log("Fetching event with filter:", filter);
  const event = await fetchEventDirectly(filter);
  if (!event) {
    bot.sendMessage(
      chatId,
      "Event nicht gefunden. Bitte überprüfen Sie die ID und versuchen Sie es erneut oder geben Sie /cancel ein, um abzubrechen.",
      {
        disable_notification: true,
      }
    );
    return;
  }

  userStates[chatId].eventToDelete = event;
  delete userStates[chatId].step; // Remove the step to stop looking for NADDR
  await sendDeletionRequestForApproval(bot, chatId, event);
};

const sendDeletionRequestForApproval = async (
  bot,
  userChatId,
  eventToDelete
) => {
  const adminChatId = config.ADMIN_CHAT_ID;
  let message = `
Löschungsanfrage für Event:
Titel: ${eventToDelete.tags.find((t) => t[0] === "name")?.[1] || "Ohne Titel"}
Datum: ${new Date(
    parseInt(eventToDelete.tags.find((t) => t[0] === "start")?.[1] || "0") *
      1000
  ).toLocaleString()}
Ort: ${
    eventToDelete.tags.find((t) => t[0] === "location")?.[1] ||
    "Kein Ort angegeben"
  }

Möchten Sie dieses Event löschen?
  `;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "Genehmigen",
          callback_data: `approve_delete_${userChatId}`,
        },
        {
          text: "Ablehnen",
          callback_data: `reject_delete_${userChatId}`,
        },
      ],
    ],
  };

  bot.sendMessage(adminChatId, message, {
    reply_markup: JSON.stringify(keyboard),
  });
  bot.sendMessage(
    userChatId,
    "Ihre Löschungsanfrage wurde zur Genehmigung an die Administratoren gesendet. Wir werden Sie benachrichtigen, sobald eine Entscheidung getroffen wurde.",
    {
      disable_notification: true,
    }
  );

  // Log the deletion suggestion
  const eventDetails = {
    title: eventToDelete.tags.find((t) => t[0] === "name")?.[1] || "Ohne Titel",
    date: new Date(
      parseInt(eventToDelete.tags.find((t) => t[0] === "start")?.[1] || "0") *
        1000
    ).toLocaleDateString("de-CH"),
    location:
      eventToDelete.tags.find((t) => t[0] === "location")?.[1] ||
      "Kein Ort angegeben",
  };
  await logEventAction(
    bot,
    "EVENT_DELETION_SUGGESTED",
    eventDetails,
    "Benutzer",
    eventToDelete.id
  );
};

export {
  handleMeetupDeletion,
  handleDeletionConfirmation,
  handleAdminMeetupDeletionApproval,
  handleDeletionInput,
  sendDeletionRequestForApproval,
};
