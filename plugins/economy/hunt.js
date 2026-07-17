const axios = require('axios');
const { readEco, writeEco, initUser, getPrefix } = require('./_db');

const HUNT_COOLDOWN = 60 * 60 * 1000;
const POKEMON_API_KEY = '1d2fd177-b0fe-415b-8739-e3df4ff6ea63';
const BASE_URL = 'https://api.pokemontcg.io/v2/cards';

async function fetchWildPokemon() {
    const { data: countData } = await axios.get(BASE_URL, {
        headers: { 'X-Api-Key': POKEMON_API_KEY },
        params: { page: 1, pageSize: 1, select: 'id' },
        timeout: 10000,
    });
    const totalCount = countData.totalCount;
    if (!totalCount || totalCount < 1) throw new Error('No cards available');

    const pageSize = 1;
    const totalPages = Math.ceil(totalCount / pageSize);
    const randomPage = Math.floor(Math.random() * totalPages) + 1;

    const { data: pageData } = await axios.get(BASE_URL, {
        headers: { 'X-Api-Key': POKEMON_API_KEY },
        params: {
            page: randomPage,
            pageSize: pageSize,
            select: 'id,name,hp,images',
        },
        timeout: 10000,
    });

    if (!pageData.data || pageData.data.length === 0) throw new Error('No wild Pokémon found');
    const card = pageData.data[0];

    return {
        name: card.name || 'Unknown Pokémon',
        hp: card.hp ? parseInt(card.hp) : 100,
        image: card.images?.small || card.images?.large || '',
    };
}

module.exports = {
    name: 'hunt',
    aliases: [],
    category: 'Economy',
    desc: 'Hunt a wild Pokémon with your own card. Win or lose cash. 1-hour cooldown. Usage: .hunt <your card name>',

    execute: async (sock, from, msg, args) => {
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

        if (!user.lastHunt) user.lastHunt = 0;
        const diff = Date.now() - user.lastHunt;
        if (diff < HUNT_COOLDOWN) {
            const rem = HUNT_COOLDOWN - diff;
            const mins = Math.floor(rem / 60000);
            const secs = Math.floor((rem % 60000) / 1000);
            return sock.sendMessage(from, {
                text: `⏳ You must wait *${mins}m ${secs}s* before hunting again.`
            });
        }

        if (!args[0]) {
            return sock.sendMessage(from, {
                text: '❌ Please specify your Pokémon card name.\nUsage: `.hunt <your card name>`'
            });
        }

        const yourCardName = args.join(' ').trim();
        const yourCard = user.pokemonDeck.find(c => c.name.toLowerCase() === yourCardName.toLowerCase());
        if (!yourCard) {
            return sock.sendMessage(from, { text: `❌ You don't have a card named *${yourCardName}*.` });
        }

        let wild;
        try {
            wild = await fetchWildPokemon();
        } catch (err) {
            console.error('[hunt] fetch error:', err.message);
            return sock.sendMessage(from, { text: '❌ Could not find a wild Pokémon. Try again later.' });
        }

        const yourPower = (yourCard.hp || 100) * (yourCard.level || 1);
        const wildPower = wild.hp;

        const displayNum = senderJid.split('@')[0];
        user.lastHunt = Date.now();

        if (yourPower > wildPower) {
            const cashEarned = Math.floor(wild.hp * 0.5);
            user.wallet += cashEarned;
            writeEco(db);

            await sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ 🏹 ≫─━─━─━╮\n` +
                `│   *HUNT SUCCESSFUL!*\n` +
                `╰━─━─━─≪ 🏹 ≫─━─━─━╯\n\n` +
                `⚔️ @${displayNum} defeated a wild *${wild.name}* (❤️${wild.hp} HP)!\n` +
                `Your card: *${yourCard.name}* (Lv.${yourCard.level || 1}, ❤️${yourCard.hp || 100})\n` +
                `Power: ${yourPower} vs ${wildPower}\n\n` +
                `💰 Earned *+${cashEarned} 💵*\n` +
                `💼 New wallet: ${user.wallet.toLocaleString()} 💵`,
                mentions: [senderJid]
            });
        } else if (wildPower > yourPower) {
            const cashLost = Math.min(user.wallet, Math.floor(wild.hp * 0.3));
            user.wallet -= cashLost;
            writeEco(db);

            await sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ 🏹 ≫─━─━─━╮\n` +
                `│   *HUNT FAILED!*\n` +
                `╰━─━─━─≪ 🏹 ≫─━─━─━╯\n\n` +
                `💀 @${displayNum} was defeated by a wild *${wild.name}* (❤️${wild.hp} HP)!\n` +
                `Your card: *${yourCard.name}* (Lv.${yourCard.level || 1}, ❤️${yourCard.hp || 100})\n` +
                `Power: ${yourPower} vs ${wildPower}\n\n` +
                `💸 Lost *-${cashLost} 💵*\n` +
                `💼 New wallet: ${user.wallet.toLocaleString()} 💵`,
                mentions: [senderJid]
            });
        } else {
            writeEco(db);
            await sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ 🏹 ≫─━─━─━╮\n` +
                `│   *HUNT DRAW!*\n` +
                `╰━─━─━─≪ 🏹 ≫─━─━─━╯\n\n` +
                `🤝 @${displayNum} fought a wild *${wild.name}* (❤️${wild.hp} HP) to a standstill!\n` +
                `Your card: *${yourCard.name}* (Lv.${yourCard.level || 1}, ❤️${yourCard.hp || 100})\n` +
                `Power: ${yourPower} vs ${wildPower}\n\n` +
                `No cash gained or lost.`,
                mentions: [senderJid]
            });
        }
    }
};
