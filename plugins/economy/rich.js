const { readEco } = require('./_db');

module.exports = {
    name:     'rich',
    aliases:  ['leaderboard', 'lb'],
    category: 'Economy',
    desc:     'View the Top 10 richest players in the server',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const db = readEco();

        const sorted = Object.entries(db.users)
            .map(([jid, u]) => ({ jid, name: u.name || 'User', net: (u.wallet || 0) + (u.bank || 0) }))
            .sort((a, b) => b.net - a.net)
            .slice(0, 10);

        if (sorted.length === 0)
            return sock.sendMessage(from, { text: '📭 No players on the leaderboard yet!' });

        const medals = ['🥇', '🥈', '🥉'];

        let text =
            `╭━─━─━─≪ 👑 ≫─━─━─━╮\n` +
            `│   *TOP 10 RICHEST*\n` +
            `╰━─━─━─≪ 👑 ≫─━─━─━╯\n`;

        sorted.forEach((u, i) => {
            const rank = medals[i] || `${i + 1}.`;
            text += `│ ${rank} *${u.name}* — ${u.net.toLocaleString()} 💵\n`;
        });

        text += `╰━─━─━─≪ 💰 ≫─━─━─━╯`;

        await sock.sendMessage(from, { text });
    }
};
