const { readEco, writeEco, initUser } = require('./_db');

const CARD_EXPIRE = 30 * 60 * 1000;

module.exports = {
    name: 'catch',
    aliases: [],
    category: 'Economy',
    desc: 'Claim an active spawned Pokémon card — .catch <name>',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText   = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix    = rawText.charAt(0);

        const db   = readEco();
        const user = initUser(db, senderJid, msg.pushName || 'User');

        const activeCard = global.activePokeSpawns.get(from + '_pokecard');
        if (!activeCard) {
            return sock.sendMessage(from, {
                text:
                `❌ *No Pokémon card is active right now!*\n` +
                `Wait for the next spawn or ask an admin to start \`${prefix}pokespawn on\``
            });
        }

        if (Date.now() - activeCard.timestamp > CARD_EXPIRE) {
            global.activePokeSpawns.delete(from + '_pokecard');
            return sock.sendMessage(from, { text: '⏳ That card *expired* before anyone could catch it! Next one coming soon.' });
        }

        if (!args[0]) {
            return sock.sendMessage(from, {
                text: `👉 Type the full Pokémon name: \`${prefix}catch ${activeCard.name}\``
            });
        }

        const inputName = args.join(' ').trim().toLowerCase();
        const cardName  = activeCard.name.trim().toLowerCase();

        if (inputName !== cardName) {
            return sock.sendMessage(from, {
                text:
                `❌ *Wrong name!* Check the spelling carefully.\n` +
                `👉 Hint: \`${prefix}catch ${activeCard.name}\``
            });
        }

        const claimCost = activeCard.price;

        if (user.orbs < claimCost) {
            return sock.sendMessage(from, {
                text:
                `❌ *Not enough orbs!*\n` +
                `You need ${claimCost} 🔮 orbs to catch this card.\n` +
                `You currently have ${user.orbs} 🔮 orbs.`
            });
        }

        user.orbs -= claimCost;

        user.pokemonDeck.push({
            name:   activeCard.name,
            rarity: activeCard.rarity,
            stars:  activeCard.stars,
            value:  activeCard.price,
            hp:     activeCard.hp || 0,
            level:  1,
            claimedAt: new Date().toISOString()
        });

        global.activePokeSpawns.delete(from + '_pokecard');
        writeEco(db);

        const displayNum = senderJid.split('@')[0];

        await sock.sendMessage(from, {
            text:
            `╭━─━─━─≪ 🎴 ≫─━─━─━╮\n` +
            `│   *POKÉMON CAUGHT!*\n` +
            `╰━─━─━─≪ 🎴 ≫─━─━─━╯\n` +
            `│ ✗ *Caught by:* @${displayNum}\n` +
            `│ ✗ *Pokémon:*   ${activeCard.name}\n` +
            `│ ✗ *Rarity:*    ${activeCard.rarity}\n` +
            `│ ✗ *Stars:*     ${activeCard.stars}\n` +
            `│ ✗ *Cost:*      -${claimCost} 🔮\n` +
            `│ ✗ *Balance:*   ${user.orbs} 🔮\n` +
            `╰━─━─━─≪ 👑 ≫─━─━─━╯`,
            mentions: [senderJid]
        });
    }
};
