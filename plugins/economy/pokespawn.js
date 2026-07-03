const axios = require('axios');
const fs = require('fs');
const path = require('path');

const POKE_SPAWN_PATH = path.join(__dirname, '../../database/pokespawner.json');
//replace this API key with your own to avoid errors, you can get it completely free from https://dev.pokemontcg.io/
const POKEMON_API_KEY = '1d2fd177-b0fe-415b-8739-e3df4ff6ea63';
const BASE_URL = 'https://api.pokemontcg.io/v2/cards';

if (!global.activePokeSpawns) global.activePokeSpawns = new Map();

function readJSON(file, fallback = {}) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { return fallback; }
}
function writeJSON(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getRarityInfo(cardRarity) {
    const r = (cardRarity || '').toLowerCase();
    if (r.includes('secret') || r.includes('rainbow')) return { label: 'LEGENDARY 🔥', stars: '⭐⭐⭐⭐⭐', price: 5000 };
    if (r.includes('ultra') || r.includes('amazing')) return { label: 'Mythic 🌟', stars: '⭐⭐⭐⭐', price: 2500 };
    if (r.includes('rare holo') || r.includes('rare ultra') || r.includes('rare shiny')) return { label: 'Epic 🔮', stars: '⭐⭐⭐', price: 1200 };
    if (r.includes('rare')) return { label: 'Rare 🔵', stars: '⭐⭐', price: 600 };
    if (r.includes('uncommon')) return { label: 'Rare 🔵', stars: '⭐⭐', price: 600 };
    return { label: 'Common ⚪', stars: '⭐', price: 300 };
}

async function fetchPokemonCard() {
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
            select: 'id,name,images,rarity,hp,types,attacks',
        },
        timeout: 10000,
    });

    if (!pageData.data || pageData.data.length === 0) throw new Error('No card on page');
    const card = pageData.data[0];

    const imageUrl = card.images?.large || card.images?.small || '';
    const rarityInfo = getRarityInfo(card.rarity);

    const hp = card.hp ? `❤️ ${card.hp} HP` : '';
    const types = card.types?.length ? `⚡ ${card.types.join('/')}` : '';
    let attackText = '';
    if (card.attacks?.length) {
        const a = card.attacks[0];
        attackText = `⚔️ ${a.name}${a.damage ? ` (${a.damage})` : ''}`;
    }
    const statsLine = [hp, types, attackText].filter(Boolean).join(' · ');

    return {
        name: card.name || 'Unknown Pokémon',
        image: imageUrl,
        rarity: rarityInfo.label,
        stars: rarityInfo.stars,
        price: rarityInfo.price,
        hp: card.hp ? parseInt(card.hp) : 0,
        statsLine,
    };
}

function startInterval(sock, groupJid, prefix, intervalMs) {
    if (global.activePokeSpawns.has(groupJid)) {
        clearInterval(global.activePokeSpawns.get(groupJid));
        global.activePokeSpawns.delete(groupJid);
    }

    const intervalId = setInterval(async () => {
        try {
            const card = await fetchPokemonCard();

            global.activePokeSpawns.set(groupJid + '_pokecard', {
                name: card.name,
                rarity: card.rarity,
                stars: card.stars,
                price: card.price,
                hp: card.hp || 0,
                timestamp: Date.now(),
            });

            const caption =
            `╭━─━─━─≪ 🎴 ≫─━─━─━╮\n` +
            `│   *POKÉMON CARD SPAWNED!*\n` +
            `╰━─━─━─≪ 🎴 ≫─━─━─━╯\n` +
            `│ ✗ *Name:*   ${card.name}\n` +
            (card.statsLine ? `│ ✗ *Stats:*   ${card.statsLine}\n` : '') +
            `│ ✗ *Rarity:* ${card.rarity}\n` +
            `│ ✗ *Stars:*  ${card.stars}\n` +
            `│ ✗ *Value:*  ${card.price} 🔮 Orbs\n` +
            `╰━─━─━─≪ 👑 ≫─━─━─━╯\n` +
            `👉 First to type \`${prefix}catch ${card.name}\` wins!`;

            if (card.image) {
                await sock.sendMessage(groupJid, { image: { url: card.image }, caption });
            } else {
                await sock.sendMessage(groupJid, { text: caption });
            }
        } catch (err) {
            console.error('[pokespawn] spawn error:', err.message);
        }
    }, intervalMs);

    global.activePokeSpawns.set(groupJid, intervalId);
}

if (!global.__pokespawnRestored) {
    global.__pokespawnRestored = true;
    (function waitForSock() {
        const check = setInterval(() => {
            if (global.sock) {
                clearInterval(check);
                const saved = readJSON(POKE_SPAWN_PATH);
                for (const gid of Object.keys(saved)) {
                    const grp = saved[gid];
                    if (grp.active && !global.activePokeSpawns.has(gid)) {
                        const mins = grp.interval || 60; // default 60 minutes
                        startInterval(global.sock, gid, '.', mins * 60 * 1000);
                        console.log(`[pokespawn] Restored spawner for ${gid} (${mins} min)`);
                    }
                }
            }
        }, 1000);
    })();
}

module.exports = {
    name: 'pokespawn',
    aliases: ['pokespawns'],
    category: 'Economy',
    desc: 'Toggle Pokémon card spawner & set interval — .pokespawn on / off / interval <minutes>',

    execute: async (sock, from, msg, args, perms) => {
        try {
            if (!from.endsWith('@g.us')) {
                return sock.sendMessage(from, { text: '❌ This command only works in groups.' });
            }

            const senderJid = msg.key.participant || msg.key.remoteJid;
            const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const prefix = rawText.charAt(0);

            let isAllowed = false;
            try {
                const meta = await sock.groupMetadata(from);
                const isAdmin = meta.participants.some(
                    p => p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
                );
                isAllowed = isAdmin || perms?.isOwner;
            } catch {
                return sock.sendMessage(from, { text: '❌ Could not verify admin status. Try again.' });
            }

            if (!isAllowed) {
                return sock.sendMessage(from, { text: '❌ Only *Group Admins* can control the Pokémon spawner.' });
            }

            const state = args[0]?.toLowerCase();

            if (state === 'interval') {
                const mins = parseInt(args[1]);
                if (isNaN(mins) || mins < 1 || mins > 1440) {
                    return sock.sendMessage(from, {
                        text: `❌ Please provide a valid number of minutes (1–1440).\nExample: \`${prefix}pokespawn interval 30\``
                    });
                }

                const data = readJSON(POKE_SPAWN_PATH);
                if (!data[from]) data[from] = { active: false };
                data[from].interval = mins;
                writeJSON(POKE_SPAWN_PATH, data);

                if (global.activePokeSpawns.has(from)) {
                    startInterval(sock, from, prefix, mins * 60 * 1000);
                }

                return sock.sendMessage(from, {
                    text: `⏱️ Pokémon spawn interval set to *${mins} minute${mins > 1 ? 's' : ''}*.\n` +
                    (global.activePokeSpawns.has(from) ? '✅ Spawner is running with new interval.' : '⚠️ Spawner is currently off – turn it on with `.pokespawn on`.')
                });
            }

            if (state === 'on') {
                if (global.activePokeSpawns.has(from)) {
                    return sock.sendMessage(from, { text: '✅ Pokémon spawner is *already running* in this group!' });
                }

                const data = readJSON(POKE_SPAWN_PATH);
                if (!data[from]) data[from] = {};
                data[from].active = true;
                data[from].startedAt = Date.now();
                writeJSON(POKE_SPAWN_PATH, data);

                const mins = data[from].interval || 60;
                startInterval(sock, from, prefix, mins * 60 * 1000);

                return sock.sendMessage(from, {
                    text:
                    `╭━─━─━─≪ 🎬 ≫─━─━─━╮\n` +
                    `│  *POKÉMON CARD SPAWNER ON*\n` +
                    `╰━─━─━─≪ 🎬 ≫─━─━─━╯\n` +
                    `│ Cards will appear every *${mins} minutes*!\n` +
                    `│ Type \`${prefix}catch <name>\` to capture!\n` +
                    `│ Change interval: \`${prefix}pokespawn interval <min>\`\n` +
                    `╰━─━─━─≪ 👾 ≫─━─━─━╯`
                });
            }

            if (state === 'off') {
                if (!global.activePokeSpawns.has(from)) {
                    return sock.sendMessage(from, { text: '❌ Pokémon spawner is not currently running in this group.' });
                }

                clearInterval(global.activePokeSpawns.get(from));
                global.activePokeSpawns.delete(from);
                global.activePokeSpawns.delete(from + '_pokecard');

                const data = readJSON(POKE_SPAWN_PATH);
                if (data[from]) {
                    data[from].active = false;
                    writeJSON(POKE_SPAWN_PATH, data);
                }

                return sock.sendMessage(from, {
                    text:
                    `╭━─━─━─≪ 🛑 ≫─━─━─━╮\n` +
                    `│  *POKÉMON CARD SPAWNER OFF*\n` +
                    `│  No more cards will appear.\n` +
                    `╰━─━─━─≪ 🛑 ≫─━─━─━╯`
                });
            }

            const data = readJSON(POKE_SPAWN_PATH);
            const currentInterval = (data[from]?.interval) || 60;
            return sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ 👾 ≫─━─━─━╮\n` +
                `│  *POKÉMON SPAWNER USAGE*\n` +
                `╰━─━─━─≪ 👾 ≫─━─━─━╯\n` +
                `│ ✗ \`${prefix}pokespawn on\`  — Start spawner\n` +
                `│ ✗ \`${prefix}pokespawn off\` — Stop spawner\n` +
                `│ ✗ \`${prefix}pokespawn interval <min>\` — Change interval\n` +
                `│\n` +
                `│ _Current interval: ${currentInterval} min_\n` +
                `│ _Admins only._\n` +
                `╰━─━─━─≪ 👑 ≫─━─━─━╯`
            });
        } catch (err) {
            console.error('[pokespawn] command error:', err);
            await sock.sendMessage(from, { text: '❌ An error occurred. Please try again.' });
        }
    }
};
