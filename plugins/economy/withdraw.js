const { readEco, writeEco, initUser, getPrefix } = require('./_db');

module.exports = {
    name: 'withdraw',
    aliases: ['wd'],
    category: 'Economy',
    desc: 'Withdraw cash from your bank vault (.withdraw <amount|all>)',

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

        if (!args[0])
            return sock.sendMessage(from, { text: '👉 Usage: `.withdraw <amount>` or `.withdraw all`' });

        let amount = args[0].toLowerCase() === 'all' ? user.bank : parseInt(args[0]);

        if (isNaN(amount) || amount <= 0)
            return sock.sendMessage(from, { text: '❌ Enter a valid positive number.' });

        if (amount > user.bank)
            return sock.sendMessage(from, { text: `❌ You only have *${user.bank} 🏦* in your bank!` });

        user.bank -= amount;
        user.wallet += amount;
        writeEco(db);

        await sock.sendMessage(from, {
            text:
                `╭━─━─━─≪ 💵 ≫─━─━─━╮\n` +
                `│  *WITHDRAWAL SUCCESS*\n` +
                `╰━─━─━─≪ 💵 ≫─━─━─━╯\n` +
                `│ ✗ *Withdrawn:* ${amount.toLocaleString()} 💵\n` +
                `│ ✗ *Wallet:*   ${user.wallet.toLocaleString()} 💵\n` +
                `│ ✗ *Bank:*     ${user.bank.toLocaleString()} 🏦\n` +
                `╰━─━─━─≪ ✅ ≫─━─━─━╯`
        });
    }
};
