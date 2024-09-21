const commands = [{
        command: 'start',
        description: 'Starte den Bot'
    },
    {
        command: 'meetups',
        description: 'Zeige bevorstehende Meetups'
    },
    {
        command: 'refresh_commands',
        description: 'Aktualisiere die Befehlsliste'
    },
    {
        command: 'links',
        description: 'Zeige Community-Links'
    },
    {
        command: 'meetup_vorschlagen',
        description: 'Schlage ein neues Event vor'
    },
    {
        command: 'meetup_loeschen',
        description: 'Beantrage die Löschung eines Events'
    }
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