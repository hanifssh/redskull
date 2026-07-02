const axios = require('axios');

const POKEMON_API_KEY = '1d2fd177-b0fe-415b-8739-e3df4ff6ea63';
const BASE_URL = 'https://api.pokemontcg.io/v2/cards';

module.exports = {
    name: 'pokeinfo',
    aliases: ['pinfo', 'info'],
    category: 'Economy',
    desc: 'Get detailed info about a Pokémon card — .pokeinfo <card name>',

    execute: async (sock, from, msg, args) => {
        console.log('[pokeinfo] command triggered, from:', from, 'args:', args);

        try {
            if (!from.endsWith('@g.us')) {
                await sock.sendMessage(from, { text: '❌ This command only works in groups.' });
                return;
            }

            if (!args[0]) {
                await sock.sendMessage(from, {
                    text: '❌ Please provide a card name.\nUsage: `.pokeinfo Charizard VMAX`'
                });
                return;
            }

            const cardName = args.join(' ').trim();

            let data;
            try {
                const res = await axios.get(BASE_URL, {
                    headers: { 'X-Api-Key': POKEMON_API_KEY },
                    params: {
                        q: `name:"${cardName}"`,
                        pageSize: 1,
                        select: 'id,name,images,rarity,hp,types,attacks,resistances,weaknesses,retreatCost,evolvesFrom,evolvesTo,set,artist'
                    },
                    timeout: 10000,
                });
                data = res.data;
            } catch (apiErr) {
                console.error('[pokeinfo] API request failed:', apiErr.message);
                await sock.sendMessage(from, { text: '❌ Failed to reach the Pokémon TCG API. Please try again later.' });
                return;
            }

            if (!data.data || data.data.length === 0) {
                try {
                    const res2 = await axios.get(BASE_URL, {
                        headers: { 'X-Api-Key': POKEMON_API_KEY },
                        params: {
                            q: `name:${cardName}*`,
                            pageSize: 1,
                            select: 'id,name,images,rarity,hp,types,attacks,resistances,weaknesses,retreatCost,evolvesFrom,evolvesTo,set,artist'
                        },
                        timeout: 10000,
                    });
                    data = res2.data;
                } catch {
                    await sock.sendMessage(from, { text: `❌ No card found for *${cardName}*.` });
                    return;
                }

                if (!data.data || data.data.length === 0) {
                    await sock.sendMessage(from, { text: `❌ No card found for *${cardName}*.` });
                    return;
                }
            }

            const card = data.data[0];
            const imageUrl = card.images?.large || card.images?.small || '';

            let info = `╭━─━─━─≪ 🎴 ≫─━─━─━╮\n`;
            info += `│   *${card.name}*\n`;
            info += `╰━─━─━─≪ 🎴 ≫─━─━─━╯\n\n`;

            if (card.rarity) info += `🌟 *Rarity:* ${card.rarity}\n`;
            if (card.hp) info += `❤️ *HP:* ${card.hp}\n`;
            if (card.types?.length) info += `⚡ *Type:* ${card.types.join('/')}\n`;

            if (card.attacks?.length) {
                info += `\n⚔️ *Attacks:*\n`;
                card.attacks.forEach((atk, i) => {
                    const cost = atk.cost?.length ? atk.cost.join(' ') + ' ' : '';
                    const damage = atk.damage ? ` (${atk.damage})` : '';
                    info += `│ ${i+1}. ${cost}${atk.name}${damage}\n`;
                });
            }

            if (card.resistances?.length) {
                info += `\n🛡️ *Resistances:*\n`;
                card.resistances.forEach(r => info += `│ ${r.type} -${r.value}\n`);
            }
            if (card.weaknesses?.length) {
                info += `\n⚡ *Weaknesses:*\n`;
                card.weaknesses.forEach(w => info += `│ ${w.type} x${w.value}\n`);
            }

            if (card.retreatCost?.length) {
                info += `\n🔙 *Retreat Cost:* ${card.retreatCost.join(' ')}\n`;
            }

            if (card.evolvesFrom) info += `\n🔹 *Evolves From:* ${card.evolvesFrom}\n`;
            if (card.evolvesTo) info += `\n🔸 *Evolves To:* ${card.evolvesTo}\n`;

            if (card.set) info += `\n📦 *Set:* ${card.set.name} (${card.set.series})\n`;
            if (card.artist) info += `\n🎨 *Illustrator:* ${card.artist}\n`;

            info += `\n╰━─━─━─≪ 👑 ≫─━─━─━╯`;

            if (imageUrl) {
                await sock.sendMessage(from, { image: { url: imageUrl }, caption: info });
            } else {
                await sock.sendMessage(from, { text: info });
            }
        } catch (err) {
            console.error('[pokeinfo] unexpected error:', err);
            await sock.sendMessage(from, { text: '❌ An unexpected error occurred. Please try again.' });
        }
    }
};
