const { readEco, initUser, getPrefix } = require('./_db');

module.exports = {
    name: 'wallet',
    aliases: ['bal', 'balance'],
    category: 'Economy',
    desc: 'Check your wallet, bank & orb balance',

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

        const text =
            `╭━─━─━─≪ 🪙 ≫─━─━─━╮\n` +
            `│     *${user.name}'s Vault*\n` +
            `╰━─━─━─≪ 🪙 ≫─━─━─━╯\n` +
            `│ ✗ *Wallet:* ${user.wallet.toLocaleString()} 💵\n` +
            `│ ✗ *Bank:*   ${user.bank.toLocaleString()} 🏦\n` +
            `│ ✗ *Orbs:*   ${user.orbs.toLocaleString()} 🔮\n` +
            `╰━─━─━─≪ 👑 ≫─━─━─━╯`;

        await sock.sendMessage(from, { text });
    }
};
