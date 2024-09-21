const commands = [{
        command: 'start',
        description: 'Start the bot'
    },
    {
        command: 'meetups',
        description: 'Show upcoming meetups'
    },
    {
        command: 'refresh_commands',
        description: 'Refresh the command list'
    },
    {
        command: 'links',
        description: 'Show community links'
    },
];

async function setupCommands(bot) {
    try {
        await bot.setMyCommands(commands);
        console.log('Commands set up successfully');
    } catch (error) {
        console.error('Error setting up commands:', error);
    }
}

module.exports = {
    setupCommands
};