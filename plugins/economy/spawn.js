const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const { activeSpawns, getSpawns, saveSpawns } = require('./_db');

function getRarity(favorites) {
    if (favorites > 25000) return { rarity: 'LEGENDARY 🔥',  stars: '⭐⭐⭐⭐⭐', price: 5000 };
    if (favorites > 10000) return { rarity: 'Mythic 🌟',      stars: '⭐⭐⭐⭐',   price: 2500 };
    if (favorites > 4000)  return { rarity: 'Epic 🔮',        stars: '⭐⭐⭐',     price: 1200 };
    if (favorites > 1000)  return { rarity: 'Rare 🔵',        stars: '⭐⭐',       price: 600  };
    return                         { rarity: 'Common ⚪',      stars: '⭐',         price: 300  };
}

function getStarCount(price) {
    if (price >= 5000) return 5;
    if (price >= 2500) return 4;
    if (price >= 1200) return 3;
    if (price >= 600)  return 2;
    return 1;
}

async function fetchCard() {
    const page = Math.floor(Math.random() * 10) + 1;
    const response = await axios.get(`https://api.jikan.moe/v4/top/characters?page=${page}&limit=25`);
    const list = response.data?.data;
    if (!list || list.length === 0) throw new Error('Empty Jikan response');

    const character = list[Math.floor(Math.random() * list.length)];
    const name = character.name.replace(/\s+/g, ' ').trim();
    const image = character.images?.jpg?.image_url || null;
    const favorites = character.favorites || 0;
    return { name, image, favorites, ...getRarity(favorites) };
}

async function generateCardImage(card) {
    const W = 512, H = 512;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    let img;
    try {
        img = await loadImage(card.image);
    } catch (err) {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, W, H);
    }

    if (img) {
        const scale = Math.max(W / img.width, H / img.height);
        const sw = img.width * scale;
        const sh = img.height * scale;
        const sx = (W - sw) / 2;
        const sy = (H - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh);
    }

    const gradient = ctx.createLinearGradient(0, H - 160, 0, H);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, H - 160, W, 160);

    ctx.fillStyle = '#ff3333';
    ctx.font = '18px "Sans", "Noto Color Emoji"';
    ctx.textAlign = 'center';
    ctx.fillText('Redskull cards', W / 2, 38);

    const nameY = H - 70;
    ctx.font = 'bold 36px "Sans", "Noto Color Emoji"';
    ctx.textAlign = 'center';
    const textMetrics = ctx.measureText(card.name);
    const boxWidth = textMetrics.width + 40;
    const boxHeight = 50;
    const boxX = (W - boxWidth) / 2;
    const boxY = nameY - 35;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(card.name, W / 2, nameY);

    const starCount = getStarCount(card.price);
    const starsString = '✮'.repeat(starCount);
    const starsY = H - 30;
    ctx.font = '30px "Sans", "Noto Color Emoji"';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(starsString, W / 2, starsY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    const framePadding = 12;
    const cornerRadius = 24;
    const x = framePadding;
    const y = framePadding;
    const w = W - framePadding * 2;
    const h = H - framePadding * 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, cornerRadius);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, w - 8, h - 8, cornerRadius - 2);
    ctx.stroke();

    return canvas.toBuffer('image/png');
}

function startSpawnInterval(sock, from, prefix, intervalMs) {
    if (activeSpawns.has(from)) {
        clearInterval(activeSpawns.get(from));
        activeSpawns.delete(from);
    }

    const intervalId = setInterval(async () => {
        try {
            const card = await fetchCard();
            activeSpawns.set(from + '_card', {
                name:      card.name,
                rarity:    card.rarity,
                stars:     card.stars,
                price:     card.price,
                timestamp: Date.now()
            });

            const cardImageBuffer = await generateCardImage(card);
            const caption =
            `╭━─━─━─≪ 👾 ≫─━─━─━╮\n` +
            `│   *ANIME CARD SPAWNED!*\n` +
            `╰━─━─━─≪ 👾 ≫─━─━─━╯\n` +
            `│ ✗ *Name:*   ${card.name}\n` +
            `│ ✗ *Rarity:* ${card.rarity}\n` +
            `│ ✗ *Grade:*  ${card.stars}\n` +
            `│ ✗ *Value:*  ${card.price} 🔮 Orbs\n` +
            `╰━─━─━─≪ 👑 ≫─━─━─━╯\n` +
            `👉 First to type \`${prefix}claim ${card.name}\` wins!`;

            await sock.sendMessage(from, { image: cardImageBuffer, caption });
        } catch (err) {
            console.error('[spawn] Jikan fetch error:', err.message);
        }
    }, intervalMs);

    activeSpawns.set(from, intervalId);
}

(function waitForSock() {
    const check = setInterval(() => {
        if (global.sock) {
            clearInterval(check);
            const spawnData = getSpawns();
            for (const groupId of Object.keys(spawnData)) {
                const grp = spawnData[groupId];
                if (grp.active && !activeSpawns.has(groupId)) {
                    const mins = grp.interval || 60;
                    startSpawnInterval(global.sock, groupId, '.', mins * 60 * 1000);
                    console.log(`[spawn] Restored spawner for ${groupId} (${mins} min)`);
                }
            }
        }
    }, 1000);
})();

module.exports = {
    name:     'spawn',
    aliases:  [],
    category: 'Economy',
    desc:     'Toggle anime card spawner & set interval — .spawn on / off / interval <minutes>',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This command only works inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText   = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix    = rawText.charAt(0);

        const meta    = await sock.groupMetadata(from);
        const isAdmin = meta.participants.some(p =>
        p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        if (!isAdmin && !perms?.isOwner)
            return sock.sendMessage(from, { text: '❌ Only *Group Admins* can control the card spawner!' });

        const state = args[0]?.toLowerCase();

        if (state === 'interval') {
            const mins = parseInt(args[1]);
            if (isNaN(mins) || mins < 1 || mins > 1440) {
                return sock.sendMessage(from, {
                    text: `❌ Please provide a valid number of minutes (1–1440).\nExample: \`${prefix}spawn interval 30\``
                });
            }

            const spawnData = getSpawns();
            if (!spawnData[from]) spawnData[from] = { active: false };
            spawnData[from].interval = mins;
            saveSpawns(spawnData);

            if (activeSpawns.has(from)) {
                startSpawnInterval(sock, from, prefix, mins * 60 * 1000);
            }

            return sock.sendMessage(from, {
                text: `⏱️ Anime card spawn interval set to *${mins} minute${mins > 1 ? 's' : ''}*.\n` +
                (activeSpawns.has(from) ? '✅ Spawner is running with new interval.' : '⚠️ Spawner is currently off – turn it on with `.spawn on`.')
            });
        }

        if (state === 'on') {
            if (activeSpawns.has(from))
                return sock.sendMessage(from, { text: '✅ Card spawner is *already running* in this group!' });

            const spawnData = getSpawns();
            if (!spawnData[from]) spawnData[from] = {};
            spawnData[from].active = true;
            spawnData[from].startedAt = Date.now();
            saveSpawns(spawnData);

            const mins = spawnData[from].interval || 60;
            startSpawnInterval(sock, from, prefix, mins * 60 * 1000);

            await sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ 🎬 ≫─━─━─━╮\n` +
                `│  *ANIME CARD SPAWNER ON*\n` +
                `╰━─━─━─≪ 🎬 ≫─━─━─━╯\n` +
                `│ Cards will appear every *${mins} minutes*!\n` +
                `│ Type \`${prefix}claim <name>\` to capture!\n` +
                `│ Change interval: \`${prefix}spawn interval <min>\`\n` +
                `╰━─━─━─≪ 👾 ≫─━─━─━╯`
            });

        } else if (state === 'off') {
            if (!activeSpawns.has(from))
                return sock.sendMessage(from, { text: '❌ Spawner is not currently running in this group.' });

            clearInterval(activeSpawns.get(from));
            activeSpawns.delete(from);
            activeSpawns.delete(from + '_card');

            const spawnData = getSpawns();
            if (spawnData[from]) {
                spawnData[from].active = false;
                saveSpawns(spawnData);
            }

            await sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ 🛑 ≫─━─━─━╮\n` +
                `│  *ANIME CARD SPAWNER OFF*\n` +
                `│  No more cards will appear.\n` +
                `╰━─━─━─≪ 🛑 ≫─━─━─━╯`
            });

        } else {
            const spawnData = getSpawns();
            const currentInterval = (spawnData[from]?.interval) || 60;
            await sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ 👾 ≫─━─━─━╮\n` +
                `│  *CARD SPAWNER USAGE*\n` +
                `╰━─━─━─≪ 👾 ≫─━─━─━╯\n` +
                `│ ✗ \`${prefix}spawn on\`  — Start spawner\n` +
                `│ ✗ \`${prefix}spawn off\` — Stop spawner\n` +
                `│ ✗ \`${prefix}spawn interval <min>\` — Change interval\n` +
                `│\n` +
                `│ _Current interval: ${currentInterval} min_\n` +
                `│ _Admins only._\n` +
                `╰━─━─━─≪ 👑 ≫─━─━─━╯`
            });
        }
    }
};
