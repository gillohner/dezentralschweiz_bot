// handlers/callbackHandler.js
import { handleLinksCallback } from "./linkHandler.js";
import { handleMeetupsFilter } from "./meetupHandlers/meetupDisplayingHandler.js";
import { handleApprovalCallbacks } from "./meetupHandlers/meetupApprovalHandler.js";
import { handleCalendarEventApprovalCallbacks } from "./calendarEventApprovalHandler.js";
import {
  sendEventForApproval,
  handleCancellation,
  handleConfirmLocation,
  handleRetryLocation,
  handleOptionalField,
  handleAdminMeetupSuggestionApproval,
  handleToggleAnonymous,
} from "./meetupHandlers/meetupSuggestionHandler.js";
import { handleAdminMeetupDeletionApproval } from "./meetupHandlers/meetupDeletionHandler.js";
import { deleteMessage } from "../utils/helpers.js";

const handleCallbackQuery = async (bot, callbackQuery) => {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (action.startsWith("links_")) {
    handleLinksCallback(bot, callbackQuery);
  } else if (action.startsWith("meetups_")) {
    const timeFrame = action.split("_")[1];
    await handleMeetupsFilter(bot, msg, timeFrame);
  } else if (
    action.startsWith("approve_cal") ||
    action.startsWith("reject_cal") ||
    action.startsWith("view_cal")
  ) {
    await handleCalendarEventApprovalCallbacks(bot, callbackQuery);
  } else if (
    (action.startsWith("approve_") || action.startsWith("reject_")) &&
    !action.includes("meetup_") &&
    !action.includes("delete_")
  ) {
    // Handle calendar event approvals (non-meetup, non-deletion)
    await handleApprovalCallbacks(bot, callbackQuery);
  } else if (
    action.startsWith("approve_meetup_") ||
    action.startsWith("reject_meetup_")
  ) {
    // Handle meetup suggestion approvals
    await handleAdminMeetupSuggestionApproval(bot, callbackQuery);
  } else if (
    action.startsWith("approve_delete_") ||
    action.startsWith("reject_delete_")
  ) {
    // Handle meetup deletion approvals
    await handleAdminMeetupDeletionApproval(bot, callbackQuery);
  } else if (action === "add_end_date") {
    handleOptionalField(bot, chatId, "end_date");
  } else if (action === "add_image") {
    handleOptionalField(bot, chatId, "image");
  } else if (action === "add_url") {
    handleOptionalField(bot, chatId, "url");
  } else if (action === "send_for_approval") {
    sendEventForApproval(bot, callbackQuery, chatId);
  } else if (action === "cancel_creation") {
    handleCancellation(bot, chatId);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Meetup-Erstellung abgebrochen",
    });
    deleteMessage(bot, chatId, msg.message_id);
  } else if (action === "confirm_location") {
    handleConfirmLocation(bot, callbackQuery);
  } else if (action === "retry_location") {
    handleRetryLocation(bot, callbackQuery);
  } else if (action === "toggle_anonymous") {
    handleToggleAnonymous(bot, callbackQuery);
  }
};

export { handleCallbackQuery };
