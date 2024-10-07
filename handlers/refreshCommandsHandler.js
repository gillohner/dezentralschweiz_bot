import {
    setupCommands
} from '../bot/commands.js';

const handleRefreshCommands = async (bot, msg) => {
    const chatId = msg.chat.id;
    try {
        await setupCommands(bot);
        bot.sendMessage(chatId, 'Befehle wurden erfolgreich aktualisiert!', {
            disable_notification: true
        });
    } catch (error) {
        console.error('Error refreshing commands:', error);
        bot.sendMessage(chatId, 'Bei der Aktualisierung der Befehle ist ein Fehler aufgetreten. Bitte versuche es später erneut.', {
            disable_notification: true
        });
    }
};

export {
    handleRefreshCommands
};