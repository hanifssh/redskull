const { readEco, writeEco, initUser } = require('./_db');

module.exports = {
    name: 'train',
    aliases: [],
    category: 'Economy',
    desc: 'Train a Pokémon card — .train <card name> (spends orbs to increase level)',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const db = readEco();
        const user = initUser(db, senderJid, msg.pushName || 'User');

        if (!args[0]) return sock.sendMessage(from, {
            text: '❌ Please provide the name of the card to train.\nExample: `.train Charizard VMAX`'
        });

        const cardName = args.join(' ').trim().toLowerCase();
        const card = user.pokemonDeck.find(c => c.name.toLowerCase() === cardName);

        if (!card) return sock.sendMessage(from, {
            text: `❌ You don't own a card named *${args.join(' ')}*.`
        });

        const currentLevel = card.level || 1;
        const cost = 500 * currentLevel;

        if (user.orbs < cost) {
            return sock.sendMessage(from, {
                text: `❌ You need *${cost}* 🔮 orbs to train this card (level ${currentLevel}).\nYou have *${user.orbs}* 🔮.`
            });
        }

        user.orbs -= cost;
        card.level = currentLevel + 1;
        writeEco(db);

        const displayNum = senderJid.split('@')[0];

        await sock.sendMessage(from, {
            text:
            `╭━─━─━─≪ ⚡ ≫─━─━─━╮\n` +
            `│   *TRAINING COMPLETE!*\n` +
            `╰━─━─━─≪ ⚡ ≫─━─━─━╯\n` +
            `│ ✗ *Trained by:* @${displayNum}\n` +
            `│ ✗ *Pokémon:*   ${card.name}\n` +
            `│ ✗ *Level:*     ${currentLevel} → ${card.level}\n` +
            `│ ✗ *Cost:*      -${cost} 🔮\n` +
            `│ ✗ *Balance:*   ${user.orbs} 🔮\n` +
            `╰━─━─━─≪ 👑 ≫─━─━─━╯`,
            mentions: [senderJid]
        });
    }
};
