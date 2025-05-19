import { handleAdminMeetupDeletionApproval } from "./meetupHandlers/meetupDeletionHandler.js";
import { handleAdminMeetupSuggestionApproval } from "./meetupHandlers/meetupSuggestionHandler.js";

const handleAdminApproval = async (bot, callbackQuery, action) => {
  if (
    action.startsWith("approve_delete_") ||
    action.startsWith("reject_delete_")
  ) {
    await handleAdminMeetupDeletionApproval(bot, callbackQuery);
  } else if (
    action.startsWith("approve_meetup_") ||
    action.startsWith("reject_meetup_")
  ) {
    await handleAdminMeetupSuggestionApproval(bot, callbackQuery);
  }
};

export { handleAdminApproval };
