const { readEco, writeEco, initUser, getPrefix } = require('./_db');

const COOLDOWN = 86_400_000;

module.exports = {
    name: 'daily',
    aliases: [],
    category: 'Economy',
    desc: 'Collect your daily cash reward (once every 24 hours)',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const db = readEco();
        const user = await initUser(sock, db, senderJid, msg.pushName || 'User');
        if (!user.registered) {
            return sock.sendMessage(from, {
                text: `❌ You haven't registered for the economy yet!\nType \`${getPrefix()}register\` to join.`
            }, { quoted: msg });
        }

        const diff = Date.now() - user.lastDaily;
        if (diff < COOLDOWN) {
            const rem = COOLDOWN - diff;
            const hrs = Math.floor(rem / 3_600_000);
            const mins = Math.floor((rem % 3_600_000) / 60_000);
            return sock.sendMessage(from, {
                text: `⏳ *Cooldown Active!*\nCome back in *${hrs}h ${mins}m* for your next daily reward.`
            });
        }

        const cash = Math.floor(Math.random() * 501) + 500;
        const orbBonus = Math.random() < 0.15 ? Math.floor(Math.random() * 3) + 1 : 0;

        user.wallet += cash;
        user.orbs += orbBonus;
        user.lastDaily = Date.now();
        writeEco(db);

        let text =
            `╭━─━─━─≪ 🎁 ≫─━─━─━╮\n` +
            `│   *DAILY REWARD CLAIMED!*\n` +
            `╰━─━─━─≪ 🎁 ≫─━─━─━╯\n` +
            `│ ✗ *Cash:*   +${cash.toLocaleString()} 💵\n`;

        if (orbBonus > 0)
            text += `│ ✗ *Orbs:*   +${orbBonus} 🔮 *(Bonus!)*\n`;

        text +=
            `│ ✗ *Wallet:* ${user.wallet.toLocaleString()} 💵\n` +
            `╰━─━─━─≪ 👑 ≫─━─━─━╯\n` +
            `_Come back in 24 hours!_`;

        await sock.sendMessage(from, { text });
    }
};
