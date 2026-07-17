const { readEco } = require('./_db');

module.exports = {
    name: 'honorboard',
    aliases: ['hb', 'honor'],
    category: 'Economy',
    desc: 'View the Top 10 most honorable players',

    execute: async (sock, from, msg) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const db = readEco();

        const ranked = Object.entries(db.users)
        .filter(([jid, u]) => u.registered)
        .map(([jid, u]) => {
            const cash = (u.wallet || 0) + (u.bank || 0);
            const cashScore = Math.floor(cash / 1000);
            const orbScore = (u.orbs || 0) * 5;
            const animeScore = (u.deck || []).reduce((sum, c) => sum + Math.floor((c.value || 0) / 100), 0);
            const pokemonScore = (u.pokemonDeck || []).reduce((sum, c) => sum + Math.floor(((c.value || 0) * (c.level || 1)) / 100), 0);
            const score = cashScore + orbScore + animeScore + pokemonScore;

            return { jid, name: u.name || 'User', score };
        })
        .sort((a, b) => b.score - a.score)
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
            const rank = medals[i] || `#${i + 1}`;
            text += `${rank}  *${u.name}*\n`;
            text += `    ┖ 🎖️ ${u.score.toLocaleString()} Honor\n\n`;
        });

        text += `╰━─━─━─≪ 👑 ≫─━─━─━╯`;

        await sock.sendMessage(from, { text });
    }
};
