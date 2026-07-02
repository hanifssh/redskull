const { readEco, writeEco, initUser, activeSpawns } = require('./_db');

const CARD_EXPIRE = 30 * 60 * 1000;

module.exports = {
    name:     'claim',
    aliases:  [],
    category: 'Economy',
    desc:     'Claim an active spawned anime card — .claim <character name>',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText   = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix    = rawText.charAt(0);

        const db   = readEco();
        const user = initUser(db, senderJid, msg.pushName || 'User');

        const activeCard = activeSpawns.get(from + '_card');
        if (!activeCard) {
            return sock.sendMessage(from, {
                text:
                `❌ *No card is active right now!*\n` +
                `Wait for the next spawn or ask an admin to start \`${prefix}spawn on\``
            });
        }

        if (Date.now() - activeCard.timestamp > CARD_EXPIRE) {
            activeSpawns.delete(from + '_card');
            return sock.sendMessage(from, { text: '⏳ That card *expired* before anyone could claim it! Next one coming soon.' });
        }

        if (!args[0]) {
            return sock.sendMessage(from, {
                text: `👉 Type the full character name: \`${prefix}claim ${activeCard.name}\``
            });
        }

        const inputName = args.join(' ').trim().toLowerCase();
        const cardName  = activeCard.name.trim().toLowerCase();

        if (inputName !== cardName) {
            return sock.sendMessage(from, {
                text:
                `❌ *Wrong name!* Check the spelling carefully.\n` +
                `👉 Hint: \`${prefix}claim ${activeCard.name}\``
            });
        }

        const claimCost = activeCard.price;

        if (user.orbs < claimCost) {
            return sock.sendMessage(from, {
                text:
                `❌ *Not enough orbs!*\n` +
                `You need ${claimCost} 🔮 orbs to claim this card.\n` +
                `You currently have ${user.orbs} 🔮 orbs.`
            });
        }

        user.orbs -= claimCost;

        user.deck.push({
            name:   activeCard.name,
            rarity: activeCard.rarity,
            stars:  activeCard.stars,
            value:  activeCard.price,
            claimedAt: new Date().toISOString()
        });

        activeSpawns.delete(from + '_card');
        writeEco(db);

        const displayNum = senderJid.split('@')[0];

        await sock.sendMessage(from, {
            text:
            `╭━─━─━─≪ 🎉 ≫─━─━─━╮\n` +
            `│   *CARD CLAIMED!*\n` +
            `╰━─━─━─≪ 🎉 ≫─━─━─━╯\n` +
            `│ ✗ *Claimed by:* @${displayNum}\n` +
            `│ ✗ *Card:*       ${activeCard.name}\n` +
            `│ ✗ *Rarity:*     ${activeCard.rarity}\n` +
            `│ ✗ *Grade:*      ${activeCard.stars}\n` +
            `│ ✗ *Cost:*       -${claimCost} 🔮\n` +
            `│ ✗ *Your Balance:* ${user.orbs} 🔮\n` +
            `╰━─━─━─≪ 👑 ≫─━─━─━╯`,
            mentions: [senderJid]
        });
    }
};
