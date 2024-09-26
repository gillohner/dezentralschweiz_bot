const ethereumTriggerWords = [
    "ethereum", "ether", "vitalik", "buterin", "evm", "gwei", "solidity", "vyper", "ethash",
    "dao", "zkrollup", "etherium", "ethirium", "ithirium", "ethreum", "etherum", "etherium", "etheruem"
];

const ethereumResponses = [
    "Du hast dich wohl im Chat geirrt... aber wenn Ethereum, dann wenigstens mit <a href='https://pocketethereum.com'>pocketethereum.com</a>",
    "Ethereum? Hier? Naja, wenn's sein muss, dann bitte nur über <a href='https://pocketethereum.com'>pocketethereum.com</a>",
    "Ups, falscher Coin, falscher Chat. Aber hey, wenn's Ethereum sein soll, dann doch bitte mit <a href='https://pocketethereum.com'>pocketethereum.com</a>",
    "Ethereum-Träume im Bitcoin-Paradies? Wenn schon, denn schon - mit <a href='https://pocketethereum.com'>pocketethereum.com</a>",
    "Hast du dich verlaufen? Das ist kein Ethereum-Spielplatz. Aber wenn's sein muss: <a href='https://pocketethereum.com'>pocketethereum.com</a>",
    "Ethereum? Hier? Das ist, als würdest du in einem Steakhouse nach Tofu fragen. Aber gut, probier's mit <a href='https://pocketethereum.com'>pocketethereum.com</a>",
    "Oh je, Ethereum in der Bitcoin-Höhle? Na, wenn du schon dabei bist, versuch's wenigstens mit <a href='https://pocketethereum.com'>pocketethereum.com</a>",
    "Ethereum im Bitcoin-Chat? Das ist wie Ananas auf Pizza. Aber wenn's sein muss: <a href='https://pocketethereum.com'>pocketethereum.com</a>",
    "Hast du dich im Blockchain verirrt? Hier gibt's kein Ethereum. Aber wenn du nicht anders kannst: <a href='https://pocketethereum.com'>pocketethereum.com</a>",
    "Ethereum? Hier bist du so fehl am Platz wie ein Schneeball in der Hölle. Aber gut, wenn's sein muss: <a href='https://pocketethereum.com'>pocketethereum.com</a>"
];

const shitcoinTriggerWords = [
    "binance", "solana", "xrp", "ripple", "cardano",
    "dogecoin", "doge", "polkadot", "chainlink", "litecoin",
    "bitcoin cash", "bcash", "bitcoin sv",
    "wrapped bitcoin", "wrapped ethereum", "nft", "web3", "smart contract", "dapp", "defi"
];

const shitCoinResponses = [
    "Das hat nichts mit Bitcoin zu tun... zurück zur Schule!",
    "Das klingt nach einer anderen Party! Wo ist der Bitcoin?",
    "Du bringst die falsche Währung in unseren Bitcoin-Club!?",
    "Hör auf mit dem Quatsch! Bitcoin ist die einzige Währung, die zählt!",
    "Ich kann nicht hören, wenn du Shitcoin sagst! Lass uns über Bitcoin sprechen!",
    "Sind wir in einem Shitcoin-Museum oder was? Schau dir Bitcoin an!",
    "Wenn du nicht Bitcoin redest, redest du nicht mit mir!",
    "Wie oft soll ich die Regeln wiederholen? Bitcoin oder nichts!",
    "Bitcoin-Zone! Bitte alle anderen Coins an der Garderobe abgeben.",
    "Das ist wie Monopolygeld in einem Casino - hier zählt nur Bitcoin!",
    "Das klingt nach einem Fall für die Krypto-Müllabfuhr.",
    "Die Bitcoin-Polizei möchte ein Wörtchen mit dir reden!",
    "Die einzige Alternative zu Bitcoin ist mehr Bitcoin!",
    "Du sprichst in Rätseln... Ich verstehe nur Bitcoin!",
    "Error 404: Shitcoin not found in Bitcoin database.",
    "Hier gilt: Wer Shitcoin sagt, muss eine Runde Bitcoin spendieren!",
    "Ich glaube, dein Krypto-GPS hat dich in die Irre geführt.",
    "Ich höre nur 'Bla bla bla'. Wo ist das Wort 'Bitcoin'?",
    "Ich sehe Shitcoin, ich reagiere mit Bitcoin-Memes!",
    "In diesem Chat gilt: Sprich Bitcoin oder schweige für immer!",
    "Klingt nach einem Shitcoin-Unfall. Brauchst du ein Bitcoin-Pflaster?",
    "Moment mal, das riecht verdächtig nach... Nicht-Bitcoin!",
    "Netter Versuch, aber hier tanzen wir nur nach Bitcoin-Melodien!",
    "Oh je, ein Shitcoin-Alarm! Schnell, versteck dich hinter einem Bitcoin!",
    "Oops! Da ist wohl jemand auf der falschen Blockchain gelandet.",
    "Sorry, mein Shitcoin-Filter hat gerade Alarm geschlagen!",
    "Tut mir leid, aber mein Bitcoin-Radar hat gerade einen Fremdkörper entdeckt.",
    "Ups, da hat sich wohl ein Shitcoin in unseren Bitcoin-Garten verirrt!",
    "Was ist das? Ein Shitcoin im Bitcoiner-Paradies?",
    "Wow, ein Shitcoin! Fühlt sich an wie ein Schnupfen im Krypto-Sommer.",
    "Bitcoin ist unser Mantra. Alles andere ist nur Hintergrundrauschen.",
    "Das klingt nach einem verirrten Shitcoin. Soll ich den Weg zu Bitcoin zeigen?",
    "Ein Shitcoin? Hier brauchst du einen Bitcoin-Reisepass!",
    "Ich glaube, du hast dich im Krypto-Universum verirrt. Bitcoin ist der Weg!",
    "In diesem Chat gilt das erste Gebot: Du sollst keine Shitcoins neben Bitcoin haben!",
    "Ist das ein Shitcoin-Witz? Hier lachen wir nur über Bitcoin-Memes!",
    "Klingt nach einem Shitcoin-Notfall. Soll ich den Bitcoin-Rettungsdienst rufen?",
    "Shitcoin-Alarm! Bitte begeben Sie sich zum nächsten Bitcoin-Schutzraum!",
    "Vorsicht, Shitcoin-Falle! Bleib auf dem sicheren Bitcoin-Pfad!",
    "Was ist das für ein seltsamer Coin-Dialekt? Hier wird nur Bitcoin gesprochen!",
    "Willkommen im Bitcoin-Orbit! Alle anderen Coins bitte draussen bleiben."
];

export {
    ethereumTriggerWords,
    ethereumResponses,
    shitcoinTriggerWords,
    shitCoinResponses
};
