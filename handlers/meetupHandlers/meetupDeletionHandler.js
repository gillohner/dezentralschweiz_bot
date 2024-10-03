const handleMeetupDeletion = (bot, msg) => {
    if (msg.chat.type !== 'private') {
        bot.sendMessage(msg.chat.id, 'Dieser Befehl funktioniert nur in privaten Nachrichten. Bitte sende mir eine direkte Nachricht, um eine Eventlöschung anzufordern.', {
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: 'Zum Bot',
                        url: `https://t.me/${bot.username}`
                    }]
                ]
            },
            disable_notification: true
        });
        return;
    }
    handleDeleteEventRequest(bot, msg);
};

const handleDeleteEventRequest = (bot, msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = {
        step: 'awaiting_event_id_for_deletion'
    };
    bot.sendMessage(chatId, "Bitte geben Sie die Event-ID oder NADDR des zu löschenden Events ein, oder /cancel um abzubrechen:", {
        disable_notification: true
    });
};

export {
    handleDeleteEventRequest,
    handleMeetupDeletion
};