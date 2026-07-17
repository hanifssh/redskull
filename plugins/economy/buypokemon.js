const axios = require('axios');
const { readEco, writeEco, initUser, getPrefix } = require('./_db');

const POKEMON_API_KEY = '1d2fd177-b0fe-415b-8739-e3df4ff6ea63';
const BASE_URL = 'https://api.pokemontcg.io/v2/cards';
const CARD_PRICE = 20000;

module.exports = {
    name: 'buypokemon',
    aliases: ['buypoke'],
    category: 'Economy',
    desc: 'Buy a Pokémon card by name — .buypokemon <name>',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;

        if (!args[0])
            return sock.sendMessage(from, { text: '👉 Usage: `.buypokemon <card name>`\nExample: `.buypokemon Charizard VMAX`' });

        const db = readEco();
        const user = await initUser(sock, db, senderJid, msg.pushName || 'User');
        if (!user.registered) {
            return sock.sendMessage(from, {
              text: `❌ You haven\'t registered for the economy yet!\nType \`${getPrefix()}register\` to join.`
            }, { quoted: msg });
        }

        const searchName = args.join(' ').trim();

        let card;
        try {
            const { data } = await axios.get(BASE_URL, {
                headers: { 'X-Api-Key': POKEMON_API_KEY },
                params: { q: `name:"${searchName}"`, pageSize: 1, select: 'id,name,hp,images' },
                timeout: 10000
            });
            card = data?.data?.[0];
        } catch (err) {
            console.error('[buypokemon] API error:', err.message);
            return sock.sendMessage(from, { text: '❌ Could not search for that card. Try again later.' });
        }

        if (!card) {
            return sock.sendMessage(from, { text: `❌ No Pokémon card found for *${searchName}*. Check the spelling.` });
        }

        const cardName = card.name;
        const hp = card.hp ? parseInt(card.hp) : 100;

        const alreadyOwned = user.pokemonDeck.find(c => c.name.toLowerCase() === cardName.toLowerCase());
        if (alreadyOwned) {
            return sock.sendMessage(from, {
                text: `❌ You already own *${cardName}*!\nCheck with \`.pokedeck\``
            });
        }

        if (user.orbs < CARD_PRICE) {
            return sock.sendMessage(from, {
                text: `❌ *Not enough orbs!*\n*${cardName}* costs *${CARD_PRICE.toLocaleString()} 🔮*\nYou have *${user.orbs.toLocaleString()} 🔮*`
            });
        }

        user.orbs -= CARD_PRICE;
        user.pokemonDeck.push({
            name: cardName,
            hp: hp,
            value: CARD_PRICE,
            level: 1,
            boughtAt: new Date().toISOString()
        });
        writeEco(db);

        const displayNum = senderJid.split('@')[0];

        await sock.sendMessage(from, {
            text:
            `╭━─━─━─≪ ⚡ ≫─━─━─━╮\n` +
            `│   *POKÉMON PURCHASED!*\n` +
            `╰━─━─━─≪ ⚡ ≫─━─━─━╯\n` +
            `│ ✗ *Buyer:*   @${displayNum}\n` +
            `│ ✗ *Card:*    ${cardName}\n` +
            `│ ✗ *HP:*      ${hp}\n` +
            `│ ✗ *Cost:*    -${CARD_PRICE.toLocaleString()} 🔮\n` +
            `│ ✗ *Balance:* ${user.orbs.toLocaleString()} 🔮\n` +
            `╰━─━─━─≪ 👑 ≫─━─━─━╯`,
            mentions: [senderJid]
        });
    }
};
