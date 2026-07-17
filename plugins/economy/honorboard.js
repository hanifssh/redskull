const { readEco } = require('./_db');

module.exports = {
    name: 'honorboard',
    aliases: ['hb', 'honor'],
    category: 'Economy',
    desc: 'View the Top 10 most honorable players based on total wealth & collection',

    execute: async (sock, from, msg) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const db = readEco();

        const ranked = Object.entries(db.users)
        .filter(([jid, u]) => u.registered)
        .map(([jid, u]) => {
            const cash = (u.wallet || 0) + (u.bank || 0);
            const orbValue = (u.orbs || 0) * 50;
            const animeCardsValue = (u.deck || []).reduce((sum, card) => sum + (card.value || 0), 0);
            const pokemonCardsValue = (u.pokemonDeck || []).reduce((sum, card) => {
                return sum + ((card.value || 0) * (card.level || 1));
            }, 0);

            const honorScore = cash + orbValue + animeCardsValue + pokemonCardsValue;

            return {
                jid,
                name: u.name || 'User',
                cash,
                orbs: u.orbs || 0,
                animeCards: (u.deck || []).length,
             pokemonCards: (u.pokemonDeck || []).length,
             honorScore
            };
        })
        .sort((a, b) => b.honorScore - a.honorScore)
        .slice(0, 10);

        if (ranked.length === 0)
            return sock.sendMessage(from, { text: '📭 No players on the honorboard yet!' });

        const medals = ['🥇', '🥈', '🥉'];

        let text =
        `╭━─━─━─≪ 🏆 ≫─━─━─━╮\n` +
        `│   *HONOR BOARD*\n` +
        `│   _Top 10 Most Honorable_\n` +
        `╰━─━─━─≪ 🏆 ≫─━─━─━╯\n\n`;

        ranked.forEach((u, i) => {
            const rank = medals[i] || `${i + 1}.`;
            text += `│ ${rank} *${u.name}*\n`;
            text += `│    ↳ Honor Score: ${u.honorScore.toLocaleString()} 🎖️\n`;
            text += `│    ↳ 💵 ${u.cash.toLocaleString()} | 🔮 ${u.orbs} | 🃏 ${u.animeCards} | ⚡ ${u.pokemonCards}\n`;
            if (i < ranked.length - 1) text += `│\n`;
        });

            text += `\n╰━─━─━─≪ 👑 ≫─━─━─━╯`;

            await sock.sendMessage(from, { text });
    }
};
