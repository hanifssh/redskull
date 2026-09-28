const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');

function getRandomJoke() {
    const jokes = [
        'Licensed to steal stickers from every chat.',
        'Authorized to yoink stickers without permission.',
        'Permit to steal memes disguised as stickers.',
        'Certified to steal the cutest stickers in the group.',
        'Licensed to snatch stickers mid-conversation.',
        'Authorized to steal stickers and call them "found".',
        'Permit to steal stickers from your sticker pack.',
        'Certified to steal sticker credits without shame.',
        'Licensed to steal stickers and sell them back.',
        'Authorized to steal stickers at 3 AM.',
        'Permit to steal stickers from your saved collection.',
        'Certified to steal stickers and blame the cat.',
        'Licensed to steal stickers and never look back.',
        'Authorized to steal stickers from anyone, anytime.',
        'Permit to steal stickers during family gatherings.'
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
}

function getRandomTier() {
    const tiers = ['GOLD', 'PLATINUM', 'DIAMOND', 'LEGENDARY', 'ELITE', 'VIP', 'PRO', 'MASTER'];
    return tiers[Math.floor(Math.random() * tiers.length)];
}

function getRandomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let id = 'STL-';
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

async function generateLicense(name, pfpUrl) {
    const W = 800;
    const H = 500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1a0000');
    grad.addColorStop(0.5, '#0d0d0d');
    grad.addColorStop(1, '#1a0000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, W - 30, H - 30);

    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(25, 25, W - 50, H - 50);

    ctx.fillStyle = '#cc0000';
    ctx.fillRect(15, 15, W - 30, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STICKER STEALING LICENSE', W / 2, 55);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ffcccc';
    ctx.fillText('AUTHORIZED BY REDSKULL CORP', W / 2, 80);

    if (pfpUrl) {
        try {
            const pfp = await loadImage(pfpUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(160, 250, 90, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(pfp, 70, 160, 180, 180);
            ctx.restore();

            ctx.strokeStyle = '#cc0000';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(160, 250, 90, 0, Math.PI * 2);
            ctx.stroke();
        } catch {}
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(name.toUpperCase().slice(0, 20), 290, 200);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('LICENSED STICKER THIEF', 290, 225);

    const licenseId = getRandomId();
    const tier = getRandomTier();

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ff3333';
    ctx.fillText(`ID: ${licenseId}`, 290, 265);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`TIER: ${tier}`, 290, 295);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('CLASSIFICATION', 290, 315);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText('AUTHORIZED ACTIVITY', 290, 355);

    const joke = getRandomJoke();
    ctx.font = 'italic 19px sans-serif';
    ctx.fillStyle = '#e0e0e0';
    const words = joke.split(' ');
    let line = '';
    let y = 385;
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > 470) {
            ctx.fillText(line.trim(), 290, y);
            line = word + ' ';
            y += 26;
        } else {
            line = test;
        }
    }
    ctx.fillText(line.trim(), 290, y);

    ctx.save();
    ctx.translate(690, 420);
    ctx.rotate(-0.3);
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#cc0000';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AUTHORIZED', 0, -18);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('REDSKULL', 0, 0);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('CORP', 0, 16);
    ctx.font = '10px sans-serif';
    ctx.fillText('2026', 0, 32);
    ctx.restore();

    ctx.fillStyle = '#666666';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Issued: ${new Date().toLocaleDateString('en-GB')}`, 50, H - 50);
    ctx.fillText('Valid: 1 year from issue', 50, H - 32);

    ctx.textAlign = 'right';
    ctx.fillText('© RedSkull Corporation', W - 50, H - 50);
    ctx.fillText('Made by Redskull bot.', W - 50, H - 32);

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'steallicense',
    aliases: ['steallicense'],
    category: 'Fun',
    desc: 'Generate your own sticker stealing license.',

    execute: async (sock, from, msg, args, perms) => {
        const senderJid = msg.key.participant || msg.key.remoteJid;

        let name = null;
        if (from.endsWith('@g.us')) {
            try {
                const meta = await sock.groupMetadata(from);
                const p = meta.participants.find(x => x.id === senderJid);
                name = p?.notify || p?.name || null;
            } catch {}
        }

        if (!name) {
            try {
                const contact = await sock.getContact?.(senderJid);
                name = contact?.notify || contact?.name || contact?.pushName || null;
            } catch {}
        }

        if (!name && msg.pushName) name = msg.pushName;
        if (!name) name = 'Sticker Thief';

        let pfpUrl = null;
        try {
            pfpUrl = await sock.profilePictureUrl(senderJid, 'image', 10000);
        } catch {}

        try {
            const buffer = await generateLicense(name, pfpUrl);

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
            const tmpPath = path.join(TEMP_DIR, `sticker_license_${Date.now()}.png`);
            fs.writeFileSync(tmpPath, buffer);

            await sock.sendMessage(from, {
                image: fs.readFileSync(tmpPath),
                                   caption:
                                   `╭━─━─━─≪ ✠ ≫─━─━─━╮\n` +
                                   `│  *STICKER LICENSE*\n` +
                                   `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
                                   `│\n` +
                                   `│ ✗ *Holder:* ${name}\n` +
                                   `│ ✗ *Issued by:* RedSkull Corp\n` +
                                   `│ ✗ *Status:* Authorized to steal\n` +
                                   `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`
            }, { quoted: msg });

            setTimeout(() => {
                try { fs.unlinkSync(tmpPath); } catch {}
            }, 30000);
        } catch (err) {
            console.error('[steallicense] error:', err.message);
            await sock.sendMessage(from, { text: '❌ Could not generate license.' }, { quoted: msg });
        }
    }
};
