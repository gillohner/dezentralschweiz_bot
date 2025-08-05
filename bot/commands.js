const commands = [
    {
        command: 'start',
        description: 'Starte den Bot'
    },
    {
        command: 'help',
        description: 'Zeige verfügbare Befehle'
    },
    {
        command: 'meetups',
        description: 'Zeige bevorstehende Meetups'
    },
    {
        command: 'links',
        description: 'Zeige Community-Links'
    },
    {
        command: 'meetup_vorschlagen',
        description: 'Neues Meetup vorschlagen'
    },
    {
        command: 'meetup_loeschen',
        description: 'Beantrage die Löschung eines Meetup'
    }
];

const setupCommands = async (bot) => {
    try {
        await bot.setMyCommands(commands);
        console.log('Commands set up successfully');
    } catch (error) {
        console.error('Error setting up commands:', error);
    }
};

export {
    setupCommands,
    commands
};