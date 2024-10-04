import telegramGroups from '../datasets/telegramGroups.js';

const handleNewMember = async (bot, msg) => {
    const chatId = msg.chat.id;
    const newMember = msg.new_chat_member;
    const groupInfo = telegramGroups[chatId.toString()];

    if (groupInfo) {
        const username = newMember.username ? `@${newMember.username}` : newMember.first_name;
        const welcomeMessage = `Hallo ${username}!\n\n${groupInfo.welcomeMessage}`;
        await bot.sendMessage(chatId, welcomeMessage, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }
};

export {
    handleNewMember
};