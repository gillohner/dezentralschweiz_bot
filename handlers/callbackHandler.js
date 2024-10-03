import {
    handleLinksCallback
} from './linkHandler.js'
import {
    handleMeetupsFilter
} from './meetupHandlers/meetupDisplayingHandler.js'

const handleCallbackQuery = async (bot, callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;

    if (action.startsWith('links_')) {
        handleLinksCallback(bot, callbackQuery);
    } else if (action.startsWith('meetups_')) {
        const timeFrame = action.split('_')[1];
        await handleMeetupsFilter(bot, msg, timeFrame);
    } else if (action.startsWith('approve_') || action.startsWith('reject_')) {
        await handleAdminApproval(bot, callbackQuery);
    } else if (action === 'add_end_date') {
        handleOptionalField(bot, chatId, 'end_date');
    } else if (action === 'add_image') {
        handleOptionalField(bot, chatId, 'image');
    } else if (action === 'add_about') {
        handleOptionalField(bot, chatId, 'about');
    } else if (action === 'send_for_approval') {
        if (userStates[chatId]) {
            sendEventForApproval(bot, chatId, userStates[chatId]);
        } else {
            bot.sendMessage(chatId, "Es tut mir leid, aber ich habe keine Informationen über dein Event. Bitte starte den Prozess erneut mit /meetup_vorschlagen.", {
                disable_notification: true
            });
        }
    } else if (action === 'cancel_creation') {
        handleCancellation(bot, chatId);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Meetup-Erstellung abgebrochen'
        });
        await bot.deleteMessage(chatId, msg.message_id);
    } else if (action === 'confirm_location') {
        console.log("local: ", userStates[chatId].tempLocation.data);
        const locationData = userStates[chatId].tempLocation.data;
        const lat = locationData.lat;
        const lon = locationData.lon;
        const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        const osmLink = "https://www.openstreetmap.org/" + locationData.osm_type + "/" + locationData.osm_id;

        userStates[chatId].osm_link = osmLink;
        userStates[chatId].gmaps_link = googleMapsLink;
        userStates[chatId].location = locationData.display_name;
        userStates[chatId].step = 'description';
        bot.sendMessage(chatId, 'Großartig! Zum Schluss, gib bitte eine kurze Beschreibung des Events ein:\n\nOder tippe /cancel um abzubrechen.', {
            disable_notification: true
        });
    } else if (action === 'retry_location') {
        userStates[chatId].step = 'location';
        bot.sendMessage(chatId, 'Okay, bitte gib die Location erneut ein:\n\nOder tippe /cancel um abzubrechen.', {
            disable_notification: true
        });
    }
};

export {
    handleCallbackQuery
};