const { readEco, writeEco, initUser, getPrefix } = require('./_db');

module.exports = {
    name: 'donateorbs',
    aliases: ['giveorbs', 'sendorbs'],
    category: 'Economy',
    desc: 'Donate orbs to another member — .donateorbs @user <amount>',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;

        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        || msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (!mentioned)
            return sock.sendMessage(from, { text: '👉 Usage: `.donateorbs @user <amount>`' });

        if (mentioned === senderJid)
            return sock.sendMessage(from, { text: '❌ You can\'t donate orbs to yourself!' });

        const amount = parseInt(args.find(a => !isNaN(parseInt(a))));
        if (!amount || amount <= 0)
            return sock.sendMessage(from, { text: '👉 Usage: `.donateorbs @user <amount>`' });

        const db       = readEco();
        const sender   = await initUser(sock, db, senderJid, msg.pushName || 'Donor');
        if (!sender.registered) {
            return sock.sendMessage(from, {
              text: `❌ You haven\'t registered for the economy yet!\nType \`${getPrefix()}register\` to join.`            }, { quoted: msg });
        }
        const receiver = await initUser(sock, db, mentioned, 'User');

        if (amount > sender.orbs)
            return sock.sendMessage(from, { text: `❌ Not enough orbs! You have *${sender.orbs} 🔮* in your balance.` });

        if (amount < 1)
            return sock.sendMessage(from, { text: '❌ Minimum donation is *1 🔮*.' });

        sender.orbs   -= amount;
        receiver.orbs += amount;
        writeEco(db);

        const receiverNum = mentioned.split('@')[0];
        const senderNum   = senderJid.split('@')[0];

        await sock.sendMessage(from, {
            text:
            `╭━─━─━─≪ 🔮 ≫─━─━─━╮\n` +
            `│   *ORBS DONATED!*\n` +
            `╰━─━─━─≪ 🔮 ≫─━─━─━╯\n` +
            `│ ✗ *From:*   @${senderNum}\n` +
            `│ ✗ *To:*     @${receiverNum}\n` +
            `│ ✗ *Amount:* ${amount.toLocaleString()} 🔮\n` +
            `╰━─━─━─≪ ✅ ≫─━─━─━╯`,
            mentions: [senderJid, mentioned]
        });
    }
};
