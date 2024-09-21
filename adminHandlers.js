const { nip19, getPublicKey } = require('nostr-tools');
const { fetchEventDirectly, publishEventToNostr } = require('./nostrUtils');

const userStates = {};

async function handleDeleteEvent(bot, msg) {
  const chatId = msg.chat.id;
  userStates[chatId] = { step: 'awaiting_event_id' };
  bot.sendMessage(chatId, "Bitte geben Sie die Event-ID oder NADDR des zu löschenden Events ein:");
}

async function handleDeleteEventInput(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (userStates[chatId].step === 'awaiting_event_id') {
    let eventId, pubkey;
    try {
      if (text.startsWith('nostr:')) {
        const decoded = nip19.decode(text.slice(6));
        if (decoded.type === 'note') {
          eventId = decoded.data;
        } else if (decoded.type === 'naddr') {
          eventId = decoded.data.identifier;
          pubkey = decoded.data.pubkey;
        }
      } else {
        eventId = text;
      }
    } catch (error) {
      console.error('Fehler beim Dekodieren von NADDR:', error);
      bot.sendMessage(chatId, "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut.");
      return;
    }

    if (!eventId) {
      bot.sendMessage(chatId, "Ungültige Event-ID oder NADDR. Bitte versuchen Sie es erneut.");
      return;
    }

    const event = await fetchEventDirectly({ ids: [eventId] });
    if (!event) {
      bot.sendMessage(chatId, "Event nicht gefunden. Bitte überprüfen Sie die ID und versuchen Sie es erneut.");
      return;
    }

    userStates[chatId].eventToDelete = event;
    const message = `
Event gefunden:
Titel: ${event.tags.find(t => t[0] === 'name')?.[1] || 'Ohne Titel'}
Datum: ${new Date(parseInt(event.tags.find(t => t[0] === 'start')?.[1] || '0') * 1000).toLocaleString()}
Ort: ${event.tags.find(t => t[0] === 'location')?.[1] || 'Kein Ort angegeben'}

Sind Sie sicher, dass Sie dieses Event löschen möchten?
`;

    const keyboard = {
      inline_keyboard: [
        [{ text: 'Ja, löschen', callback_data: 'confirm_delete' }],
        [{ text: 'Nein, abbrechen', callback_data: 'cancel_delete' }]
      ]
    };

    bot.sendMessage(chatId, message, { reply_markup: JSON.stringify(keyboard) });
    userStates[chatId].step = 'awaiting_confirmation';
  }
}

async function handleDeleteEventConfirmation(bot, query) {
  const chatId = query.message.chat.id;

  if (query.data === 'confirm_delete') {
    const eventToDelete = userStates[chatId].eventToDelete;
    const privateKey = process.env.BOT_NSEC;
    const publicKey = getPublicKey(privateKey);

    const deleteEvent = {
      kind: 5,
      pubkey: publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', eventToDelete.id],
        ['a', `31923:${eventToDelete.pubkey}:${eventToDelete.tags.find(t => t[0] === 'd')?.[1]}`]
      ],
      content: 'Event von Admin gelöscht'
    };

    try {
      await publishEventToNostr(deleteEvent);
      bot.answerCallbackQuery(query.id, { text: 'Event erfolgreich gelöscht' });
      bot.sendMessage(chatId, 'Das Event wurde gelöscht.');
    } catch (error) {
      console.error('Fehler beim Veröffentlichen des Lösch-Events:', error);
      bot.answerCallbackQuery(query.id, { text: 'Fehler beim Löschen des Events' });
      bot.sendMessage(chatId, 'Es gab einen Fehler beim Löschen des Events. Bitte versuchen Sie es später erneut.');
    }
  } else if (query.data === 'cancel_delete') {
    bot.answerCallbackQuery(query.id, { text: 'Löschvorgang abgebrochen' });
    bot.sendMessage(chatId, 'Löschvorgang des Events abgebrochen.');
  }

  delete userStates[chatId];
}

module.exports = {
  handleDeleteEvent,
  handleDeleteEventInput,
  handleDeleteEventConfirmation
};
