const { createCanvas, loadImage } = require('canvas');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');

function getRandomCrime() {
    const crimes = [
        'Stealing memes without credit',
        'Being too cringe in public',
        'Simping in 4K resolution',
        'Sending "hey" and never replying',
        'Stealing snacks from the fridge at 3 AM',
        'Laughing at his own jokes',
        'Posting selfies for validation',
        'Stealing WiFi from neighbors',
        'Living rent free in people\'s heads',
        'Being a Discord mod without a life',
        'Sending 47 voice notes in a row',
        'Forwarding good morning messages',
        'Taking 40 min to reply with "k"',
        'Ghosting after one date',
        'Listening to sad songs at 2 AM',
        'Arguing with strangers online',
        'Being "not like other guys"',
        'Using ChatGPT to write love texts',
        'Copy-pasting motivational quotes',
        'Reposting TikToks as original content'
    ];
    return crimes[Math.floor(Math.random() * crimes.length)];
}

function getRandomBounty() {
    const bounties = [500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
    const bounty = bounties[Math.floor(Math.random() * bounties.length)];
    return `$${bounty.toLocaleString()}`;
}

async function getProfilePic(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image', 10000);
    } catch {
        return null;
    }
}

async function resolveJid(sock, jid) {
    if (!jid) return jid;
    jid = jid.split(':')[0];
    if (!jid.includes('@')) jid += '@s.whatsapp.net';

    if (jid.endsWith('@lid')) {
        try {
            const mapped = await sock.signalRepository?.lidMapping?.getPNForLID(jid);
            if (mapped) return mapped.split(':')[0].split('@')[0] + '@s.whatsapp.net';
        } catch {}
    }
    return jid;
}

async function getName(sock, from, jid) {
    if (from.endsWith('@g.us')) {
        try {
            const meta = await sock.groupMetadata(from);
            const p = meta.participants.find(x =>
            x.id === jid ||
            x.id.split(':')[0] === jid ||
            x.phoneNumber === jid
            );
            if (p?.notify) return p.notify;
            if (p?.name) return p.name;
        } catch {}
    }
    try {
        const contact = await sock.getContact?.(jid);
        if (contact) {
            const n = contact.notify || contact.name || contact.pushName;
            if (n) return n;
        }
    } catch {}
    return null;
}

async function generateWantedCard(imageSource, name) {
    const W = 700;
    const H = 950;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const parchmentGrad = ctx.createLinearGradient(0, 0, 0, H);
    parchmentGrad.addColorStop(0, '#f5e6c8');
    parchmentGrad.addColorStop(0.5, '#ebd9b4');
    parchmentGrad.addColorStop(1, '#e0c89a');
    ctx.fillStyle = parchmentGrad;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        const size = Math.random() * 2;
        ctx.fillStyle = `rgba(120, 90, 50, ${Math.random() * 0.15})`;
        ctx.fillRect(x, y, size, size);
    }

    ctx.strokeStyle = '#4a2f15';
    ctx.lineWidth = 8;
    ctx.strokeRect(15, 15, W - 30, H - 30);

    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    const corners = [[20, 20], [W - 60, 20], [20, H - 60], [W - 60, H - 60]];
    for (const [cx, cy] of corners) {
        ctx.fillStyle = '#4a2f15';
        ctx.beginPath();
        ctx.arc(cx + 20, cy + 20, 12, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = '#3a1a0a';
    ctx.font = 'bold 72px serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', W / 2, 130);

    ctx.strokeStyle = '#3a1a0a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(80, 150);
    ctx.lineTo(W - 80, 150);
    ctx.stroke();

    ctx.font = 'italic 20px serif';
    ctx.fillStyle = '#5a2a10';
    ctx.fillText('DEAD OR ALIVE', W / 2, 180);

    const imgSize = 380;
    const imgY = 220;
    const imgX = (W - imgSize) / 2;

    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(imgX - 20, imgY - 20, imgSize + 40, imgSize + 40);
    ctx.strokeStyle = '#4a2f15';
    ctx.lineWidth = 6;
    ctx.strokeRect(imgX - 20, imgY - 20, imgSize + 40, imgSize + 40);

    if (imageSource) {
        try {
            const img = await loadImage(imageSource);
            ctx.save();
            ctx.beginPath();
            ctx.rect(imgX, imgY, imgSize, imgSize);
            ctx.closePath();
            ctx.clip();
            const scale = Math.max(imgSize / img.width, imgSize / img.height);
            const sw = img.width * scale;
            const sh = img.height * scale;
            const sx = imgX + (imgSize - sw) / 2;
            const sy = imgY + (imgSize - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh);
            ctx.restore();

            ctx.fillStyle = 'rgba(120, 80, 40, 0.35)';
            ctx.fillRect(imgX, imgY, imgSize, imgSize);

            ctx.strokeStyle = '#4a2f15';
            ctx.lineWidth = 4;
            ctx.strokeRect(imgX, imgY, imgSize, imgSize);
        } catch {
            ctx.fillStyle = '#d4b87a';
            ctx.fillRect(imgX, imgY, imgSize, imgSize);
            ctx.fillStyle = '#4a2f15';
            ctx.font = 'bold 60px serif';
            ctx.textAlign = 'center';
            ctx.fillText('?', W / 2, imgY + imgSize / 2 + 20);
        }
    } else {
        ctx.fillStyle = '#d4b87a';
        ctx.fillRect(imgX, imgY, imgSize, imgSize);
        ctx.fillStyle = '#4a2f15';
        ctx.font = 'bold 60px serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', W / 2, imgY + imgSize / 2 + 20);
    }

    const nameY = imgY + imgSize + 90;
    ctx.fillStyle = '#3a1a0a';
    ctx.font = 'bold 34px serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.toUpperCase().slice(0, 22), W / 2, nameY);

    const crimeY = nameY + 60;
    ctx.fillStyle = '#5a2a10';
    ctx.font = 'italic 20px serif';
    ctx.fillText('WANTED FOR:', W / 2, crimeY);

    const crime = getRandomCrime();
    ctx.fillStyle = '#3a1a0a';
    ctx.font = 'bold 22px serif';
    const words = crime.split(' ');
    const lines = [];
    let line = '';
    const maxW = W - 140;
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxW) {
            lines.push(line.trim());
            line = word + ' ';
        } else {
            line = test;
        }
    }
    lines.push(line.trim());

    let cy = crimeY + 35;
    for (const l of lines) {
        ctx.fillText(l, W / 2, cy);
        cy += 28;
    }

    const rewardY = cy + 40;
    ctx.strokeStyle = '#3a1a0a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(100, rewardY - 25);
    ctx.lineTo(W - 100, rewardY - 25);
    ctx.stroke();

    ctx.fillStyle = '#5a2a10';
    ctx.font = 'bold 24px serif';
    ctx.fillText('REWARD', W / 2, rewardY);

    const bounty = getRandomBounty();
    ctx.fillStyle = '#8b0000';
    ctx.font = 'bold 56px serif';
    ctx.fillText(bounty, W / 2, rewardY + 60);

    ctx.fillStyle = '#3a1a0a';
    ctx.font = 'italic 14px serif';
    ctx.fillText('Contact local sheriff for information', W / 2, H - 60);

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'wanted',
    aliases: ['wantedposter','wanted'],
    category: 'Fun',
    desc: 'Generate a wanted poster.\n.wanted @user\n.wanted (reply to photo)',

    execute: async (sock, from, msg, args, perms) => {
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const mentioned = contextInfo?.mentionedJid?.[0];
        const quotedParticipant = contextInfo?.participant;
        const quotedMsg = contextInfo?.quotedMessage;

        let targetJid = null;
        let imageSource = null;

        if (mentioned) {
            targetJid = mentioned;
        } else if (quotedParticipant && quotedMsg) {
            targetJid = quotedParticipant;
        } else {
            return sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ ✠ ≫─━─━─━╮\n` +
                `│    *WANTED POSTER*\n` +
                `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
                `│\n` +
                `│ ✗ .wanted @user\n` +
                `│ ✗ Reply to a photo\n` +
                `│ ✗ with .wanted\n` +
                `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`
            }, { quoted: msg });
        }

        const realJid = await resolveJid(sock, targetJid);
        const name = await getName(sock, from, realJid) || 'Wanted';

        if (quotedMsg?.imageMessage) {
            try {
                const stream = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
                let chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                imageSource = Buffer.concat(chunks);
            } catch {
                imageSource = await getProfilePic(sock, realJid);
                if (!imageSource) imageSource = await getProfilePic(sock, targetJid);
            }
        } else {
            imageSource = await getProfilePic(sock, realJid);
            if (!imageSource) imageSource = await getProfilePic(sock, targetJid);
        }

        try {
            const buffer = await generateWantedCard(imageSource, name);

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
            const tmpPath = path.join(TEMP_DIR, `wanted_${Date.now()}.png`);
            fs.writeFileSync(tmpPath, buffer);

            await sock.sendMessage(from, {
                image: fs.readFileSync(tmpPath),
                                   caption: `🤠 *WANTED*\n\n@${targetJid.split('@')[0]} is on the run 💰`,
                                   mentions: [targetJid]
            }, { quoted: msg });

            setTimeout(() => {
                try { fs.unlinkSync(tmpPath); } catch {}
            }, 30000);
        } catch (err) {
            console.error('[wanted] error:', err.message);
            await sock.sendMessage(from, { text: '❌ Could not generate wanted poster.' }, { quoted: msg });
        }
    }
};
