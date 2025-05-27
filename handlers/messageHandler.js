import {
  ethereumTriggerWords,
  ethereumResponses,
  shitcoinTriggerWords,
  shitCoinResponses,
} from "../datasets/shitcoinLists.js";
import userStates from "../userStates.js";
import { handleDeletionInput } from "./meetupHandlers/meetupDeletionHandler.js";
import { handleEventCreationStep } from "./meetupHandlers/meetupSuggestionHandler.js";
import { TidyURL } from "tidy-url";

const handleMessage = (bot, msg) => {
  if (msg.chat.type === "private") {
    const chatId = msg.chat.id;
    if (userStates[chatId]?.step === "awaiting_event_id_for_deletion") {
      handleDeletionInput(bot, msg);
    } else {
      handleEventCreationStep(bot, msg);
    }
  } else {
    const text = msg.text || "";

    // Comprehensive regex to match URLs
    const urlRegex =
      /(?:(?:https?:\/\/)?(?:www\.)?)?[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,}(?::[0-9]{1,5})?(?:\/[^\s]*)?/gi;

    let match;
    let cleanedUrls = [];
    let twitterUrls = [];

    while ((match = urlRegex.exec(text)) !== null) {
      let originalUrl = match[0];
      if (!originalUrl.startsWith("http")) {
        originalUrl = "https://" + originalUrl;
      }

      const cleanedUrl = TidyURL.clean(originalUrl).url;

      if (cleanedUrl !== originalUrl) {
        cleanedUrls.push(`${cleanedUrl}`);
      }

      if (
        originalUrl.includes("twitter.com") ||
        originalUrl.includes("x.com")
      ) {
        const nitterUrl = cleanedUrl.replace(
          /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)/,
          "https://nitter.yourdevice.ch"
        );
        twitterUrls.push(`${nitterUrl}`);
      }
    }

    // Send cleaned URLs
    if (cleanedUrls.length > 0) {
      const message = "NO-KYC Urls:\n" + cleanedUrls.join("\n");
      bot.sendMessage(msg.chat.id, message, {
        disable_web_page_preview: true,
        disable_notification: true,
      });
    }

    // Send Twitter/X URLs with Nitter alternatives
    if (twitterUrls.length > 0) {
      const message = twitterUrls.join("\n");
      bot.sendMessage(msg.chat.id, message, {
        disable_web_page_preview: true,
        disable_notification: true,
      });
    }

    // Rest of your existing code for Ethereum and shitcoin checks
    const lowerText = text.toLowerCase();

    // Check for Ethereum trigger words
    const isEthereum = ethereumTriggerWords.some((word) => {
      return new RegExp(`\\b${word}\\b`).test(lowerText);
    });

    if (isEthereum) {
      const response =
        ethereumResponses[Math.floor(Math.random() * ethereumResponses.length)];
      bot.sendMessage(msg.chat.id, response, {
        parse_mode: "HTML",
        disable_notification: true,
      });
    }

    // Check for other shitcoin trigger words
    let matchedShitcoin = "";
    const isShitcoin = shitcoinTriggerWords.some((word) => {
      const match = new RegExp(`\\b${word}\\b`).test(lowerText);
      if (match) {
        matchedShitcoin = word;
      }
      return match;
    });

    if (isShitcoin) {
      const response =
        matchedShitcoin.toUpperCase() +
        "?!\n\n" +
        shitCoinResponses[Math.floor(Math.random() * shitCoinResponses.length)];
      bot.sendMessage(msg.chat.id, response, {
        parse_mode: "HTML",
        disable_notification: true,
      });
    }
  }
};

export { handleMessage };
