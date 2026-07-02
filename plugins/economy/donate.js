const { readEco, writeEco, initUser } = require('./_db');

module.exports = {
    name:     'donate',
    aliases:  ['pay', 'transfer'],
    category: 'Economy',
    desc:     'Donate cash to another member — .donate @user <amount>',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText   = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix    = rawText.charAt(0);

        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                       || msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (!mentioned)
            return sock.sendMessage(from, { text: `👉 Usage: \`${prefix}donate @user <amount>\`` });

        if (mentioned === senderJid)
            return sock.sendMessage(from, { text: '❌ You can\'t donate to yourself!' });

        const amount = parseInt(args.find(a => !isNaN(parseInt(a))));
        if (!amount || amount <= 0)
            return sock.sendMessage(from, { text: `👉 Usage: \`${prefix}donate @user <amount>\`` });

        const db       = readEco();
        const sender   = initUser(db, senderJid,  msg.pushName || 'Donor');
        const receiver = initUser(db, mentioned,   'User');

        if (amount > sender.wallet)
            return sock.sendMessage(from, { text: `❌ Not enough cash! You have *${sender.wallet} 💵* in wallet.` });

        if (amount < 10)
            return sock.sendMessage(from, { text: '❌ Minimum donation is *10 💵*.' });

        sender.wallet   -= amount;
        receiver.wallet += amount;
        writeEco(db);

        const receiverNum = mentioned.split('@')[0];
        const senderNum   = senderJid.split('@')[0];

        await sock.sendMessage(from, {
            text:
                `╭━─━─━─≪ 💝 ≫─━─━─━╮\n` +
                `│    *DONATION SENT!*\n` +
                `╰━─━─━─≪ 💝 ≫─━─━─━╯\n` +
                `│ ✗ *From:*   @${senderNum}\n` +
                `│ ✗ *To:*     @${receiverNum}\n` +
                `│ ✗ *Amount:* ${amount.toLocaleString()} 💵\n` +
                `╰━─━─━─≪ ✅ ≫─━─━─━╯`,
            mentions: [senderJid, mentioned]
        });
    }
};
