const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');

function getRandomJoke() {
    const jokes = [
        'Licensed to simp for fictional characters.',
        'Authorized to be down bad 24/7.',
        'Permit to thirst over anime waifus.',
        'Certified to be horny on main.',
        'Licensed to simp without shame.',
        'Authorized to be down bad in every group.',
        'Permit to thirst trap the entire chat.',
        'Certified to be horny during family gatherings.',
        'Licensed to simp for people who ignore you.',
        'Authorized to be down bad at 3 AM.',
        'Permit to thirst over pixels on a screen.',
        'Certified to be horny in every situation.',
        'Licensed to simp for your own reflection.',
        'Authorized to be down bad and still have no rizz.',
        'Permit to thirst over fictional characters unironically.'
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
}

function getRandomTier() {
    const tiers = ['DOWN BAD', 'SIMP LORD', 'THIRST KING', 'HORNY ELITE', 'ULTRA SIMP', 'GIGA THIRST', 'MEGA DOWN BAD', 'OMEGA SIMP'];
    return tiers[Math.floor(Math.random() * tiers.length)];
}

function getRandomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let id = 'HRN-';
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

function getRandomIssued() {
    const items = [
        'Issued: During peak horny hours (3 AM)',
        'Issued: Right after watching that one anime',
        'Issued: When the intrusive thoughts won',
        'Issued: During the horniest moment of the year',
        'Issued: Right before opening Instagram',
        'Issued: Mid-simp session',
        'Issued: While scrolling through waifu pics',
        'Issued: On a lonely Saturday night',
        'Issued: When nobody was watching',
        'Issued: During a questionable dream',
        'Issued: At the peak of down bad energy',
        'Issued: While pretending not to simp'
    ];
    return items[Math.floor(Math.random() * items.length)];
}

function getRandomValidity() {
    const items = [
        'Valid: Until the next thirst trap',
        'Valid: Until you get rejected',
        'Valid: Until someone says hello to you',
        'Valid: Until you touch grass',
        'Valid: Until your crush replies',
        'Valid: Until the next full moon',
        'Valid: Until you find a real person',
        'Valid: Until your phone dies',
        'Valid: Until the vibes run out',
        'Valid: Until your simp energy fades'
    ];
    return items[Math.floor(Math.random() * items.length)];
}

async function generateLicense(name, pfpUrl) {
    const W = 800;
    const H = 500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#3a2a00');
    grad.addColorStop(0.5, '#1a1300');
    grad.addColorStop(1, '#3a2a00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 500);
    glow.addColorStop(0, 'rgba(255, 215, 0, 0.15)');
    glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, W - 30, H - 30);

    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.strokeRect(25, 25, W - 50, H - 50);

    ctx.fillStyle = '#ffd700';
    ctx.fillRect(15, 15, W - 30, 70);

    ctx.fillStyle = '#1a1300';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HORNY LICENSE', W / 2, 55);

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#3a2a00';
    ctx.fillText('CERTIFIED BY REDSKULL CORP', W / 2, 80);

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

            ctx.strokeStyle = '#ffd700';
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

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('CERTIFIED HORNY INDIVIDUAL', 290, 225);

    const licenseId = getRandomId();
    const tier = getRandomTier();

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`ID: ${licenseId}`, 290, 265);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffed4e';
    ctx.fillText(`TIER: ${tier}`, 290, 295);

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('HORNY LEVEL', 290, 315);

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#c9a227';
    ctx.fillText('AUTHORIZED ACTIVITY', 290, 355);

    const joke = getRandomJoke();
    ctx.font = 'italic 19px sans-serif';
    ctx.fillStyle = '#fff4c2';
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
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CERTIFIED', 0, -18);
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('REDSKULL', 0, 0);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('CORP', 0, 16);
    ctx.font = '10px sans-serif';
    ctx.fillText('2026', 0, 32);
    ctx.restore();

    const issuedText = getRandomIssued();
    const validText = getRandomValidity();

    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(issuedText, 50, H - 50);
    ctx.fillText(validText, 50, H - 32);

    ctx.textAlign = 'right';
    ctx.fillText('© RedSkull Corporation', W - 50, H - 50);
    ctx.fillText('Certified by the horny council', W - 50, H - 32);

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'hornylicense',
    aliases: ['hornylicense'],
    category: 'Fun',
    desc: 'Generate a horny license card.',

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
        if (!name) name = 'Horny One';

        let pfpUrl = null;
        try {
            pfpUrl = await sock.profilePictureUrl(senderJid, 'image', 10000);
        } catch {}

        try {
            const buffer = await generateLicense(name, pfpUrl);

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
            const tmpPath = path.join(TEMP_DIR, `horny_license_${Date.now()}.png`);
            fs.writeFileSync(tmpPath, buffer);

            await sock.sendMessage(from, {
                image: fs.readFileSync(tmpPath),
                                   caption:
                                   `╭━─━─━─≪ ✠ ≫─━─━─━╮\n` +
                                   `│    *HORNY LICENSE*\n` +
                                   `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
                                   `│\n` +
                                   `│ ✗ *Holder:* ${name}\n` +
                                   `│ ✗ *Certified by:* RedSkull Corp\n` +
                                   `│ ✗ *Status:* Down bad\n` +
                                   `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`
            }, { quoted: msg });

            setTimeout(() => {
                try { fs.unlinkSync(tmpPath); } catch {}
            }, 30000);
        } catch (err) {
            console.error('[hornylicense] error:', err.message);
            await sock.sendMessage(from, { text: '❌ Could not generate license.' }, { quoted: msg });
        }
    }
};
