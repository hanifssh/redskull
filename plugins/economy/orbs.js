const { readEco, writeEco, initUser } = require('./_db');

const ORB_PRICE = 500;

module.exports = {
    name:     'orbs',
    aliases:  ['buyorbs'],
    category: 'Economy',
    desc:     'Check your orbs (.orbs) or buy more (.buyorbs <qty>)',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText   = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix    = rawText.charAt(0);
        const command   = rawText.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();

        const db   = readEco();
        const user = initUser(db, senderJid, msg.pushName || 'User');

        if (command === 'orbs') {
            return sock.sendMessage(from, {
                text:
                    `╭━─━─━─≪ 🔮 ≫─━─━─━╮\n` +
                    `│   *${user.name}'s ORBS*\n` +
                    `╰━─━─━─≪ 🔮 ≫─━─━─━╯\n` +
                    `│ ✗ *Orbs:*   ${user.orbs} 🔮\n` +
                    `│ ✗ *Wallet:* ${user.wallet.toLocaleString()} 💵\n` +
                    `│\n` +
                    `│ _Buy orbs: \`${prefix}buyorbs <qty>\`_\n` +
                    `│ _Rate: ${ORB_PRICE} 💵 per orb_\n` +
                    `╰━─━─━─≪ ✨ ≫─━─━─━╯`
            });
        }

        const qty = parseInt(args[0]);
        if (!qty || qty <= 0)
            return sock.sendMessage(from, { text: `👉 Usage: \`${prefix}buyorbs <quantity>\`\n_Rate: ${ORB_PRICE} 💵 per orb_` });

        const totalCost = qty * ORB_PRICE;
        if (totalCost > user.wallet)
            return sock.sendMessage(from, {
                text:
                    `❌ *Not enough cash!*\n` +
                    `│ *${qty} orbs* costs *${totalCost.toLocaleString()} 💵*\n` +
                    `│ You have *${user.wallet.toLocaleString()} 💵*`
            });

        user.wallet -= totalCost;
        user.orbs   += qty;
        writeEco(db);

        await sock.sendMessage(from, {
            text:
                `╭━─━─━─≪ 🔮 ≫─━─━─━╮\n` +
                `│   *ORBS PURCHASED!*\n` +
                `╰━─━─━─≪ 🔮 ≫─━─━─━╯\n` +
                `│ ✗ *Bought:*  +${qty} 🔮\n` +
                `│ ✗ *Paid:*    -${totalCost.toLocaleString()} 💵\n` +
                `│ ✗ *Orbs Now:* ${user.orbs} 🔮\n` +
                `│ ✗ *Wallet:*  ${user.wallet.toLocaleString()} 💵\n` +
                `╰━─━─━─≪ ✅ ≫─━─━─━╯`
        });
    }
};
