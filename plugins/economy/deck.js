const { readEco, initUser, getPrefix } = require('./_db');

module.exports = {
    name: 'deck',
    aliases: [],
    category: 'Economy',
    desc: 'View all anime cards in your collection',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const db        = readEco();
        const user      = await initUser(sock, db, senderJid, msg.pushName || 'User');
        if (!user.registered) {
            return sock.sendMessage(from, {
                text: `❌ You haven't registered for the economy yet!\nType \`${getPrefix()}register\` to join.`
            }, { quoted: msg });
        }

        if (user.deck.length === 0) {
            return sock.sendMessage(from, {
                text:
                    `╭━─━─━─≪ 🃏 ≫─━─━─━╮\n` +
                    `│   *${user.name}'s DECK*\n` +
                    `╰━─━─━─≪ 🃏 ≫─━─━─━╯\n` +
                    `│ 📭 Your deck is empty!\n` +
                    `│ Wait for card spawns to collect some.\n` +
                    `╰━─━─━─≪ ✨ ≫─━─━─━╯`
            });
        }

        const sorted = [...user.deck].sort((a, b) => (b.value || 0) - (a.value || 0));

        let text =
            `╭━─━─━─≪ 🃏 ≫─━─━─━╮\n` +
            `│   *${user.name}'s CARD DECK*\n` +
            `│   _${sorted.length} card(s) collected_\n` +
            `╰━─━─━─≪ 🃏 ≫─━─━─━╯\n`;

        sorted.forEach((card, i) => {
            text += `│ ${i + 1}. *${card.name}*\n`;
            text += `│    ↳ ${card.rarity || '?'} | ${card.stars || '⭐'} | ${(card.value || 0)} 🔮\n`;
        });

        text +=
            `╰━─━─━─≪ ✨ ≫─━─━─━╯\n` +
            `│ *Total Orbs Value:* ${sorted.reduce((s, c) => s + (c.value || 0), 0).toLocaleString()} 🔮`;

        await sock.sendMessage(from, { text });
    }
};
