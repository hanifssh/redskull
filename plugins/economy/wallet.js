const { readEco, initUser } = require('./_db');

module.exports = {
    name:     'wallet',
    aliases:  ['bal', 'balance'],
    category: 'Economy',
    desc:     'Check your wallet, bank & orb balance',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid  = msg.key.participant || msg.key.remoteJid;
        const db         = readEco();
        const user       = initUser(db, senderJid, msg.pushName || 'User');

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
