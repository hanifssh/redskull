const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');

function getRandomHandle(name) {
    const cleaned = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const base = cleaned.slice(0, 12) || 'user';
    const num = Math.floor(Math.random() * 9999);
    return `@${base}${num}`;
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

async function getSenderName(sock, msg) {
    try {
        const jid = msg.key.participant || msg.key.remoteJid;
        const contact = await sock.getContact?.(jid) || null;
        if (contact) {
            const name = contact.name || contact.notify || contact.verifiedName || contact.pushName;
            if (name && name !== 'undefined') return name;
        }
    } catch {}

    if (msg.pushName) return msg.pushName;

    return null;
}

async function generateTweetCard(imageSource, name, tweetText) {
    const W = 700;
    const H = 500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    const cardGrad = ctx.createLinearGradient(0, 0, 0, H);
    cardGrad.addColorStop(0, '#16181c');
    cardGrad.addColorStop(1, '#0f1114');
    ctx.fillStyle = cardGrad;
    ctx.fillRect(30, 30, W - 60, H - 60);

    ctx.strokeStyle = '#2f3336';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    const pfpSize = 60;
    const pfpX = 60;
    const pfpY = 60;

    if (imageSource) {
        try {
            const img = await loadImage(imageSource);
            ctx.save();
            ctx.beginPath();
            ctx.arc(pfpX + pfpSize / 2, pfpY + pfpSize / 2, pfpSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            const scale = Math.max(pfpSize / img.width, pfpSize / img.height);
            const sw = img.width * scale;
            const sh = img.height * scale;
            const sx = pfpX + pfpSize / 2 - sw / 2;
            const sy = pfpY + pfpSize / 2 - sh / 2;
            ctx.drawImage(img, sx, sy, sw, sh);
            ctx.restore();
        } catch {
            ctx.fillStyle = '#2f3336';
            ctx.beginPath();
            ctx.arc(pfpX + pfpSize / 2, pfpY + pfpSize / 2, pfpSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        ctx.fillStyle = '#2f3336';
        ctx.beginPath();
        ctx.arc(pfpX + pfpSize / 2, pfpY + pfpSize / 2, pfpSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    const displayName = name.slice(0, 18);
    const handle = getRandomHandle(name);

    ctx.fillStyle = '#e7e9ea';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(displayName, pfpX + pfpSize + 15, pfpY + 25);

    ctx.fillStyle = '#71767b';
    ctx.font = '15px sans-serif';
    ctx.fillText(handle, pfpX + pfpSize + 15, pfpY + 48);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#1d9bf0';
    ctx.fillText('𝕏', W - 80, 95);

    ctx.fillStyle = '#e7e9ea';
    ctx.font = '24px sans-serif';
    const words = tweetText.split(' ');
    const lines = [];
    let line = '';
    const maxW = W - 120;
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

    let ty = 200;
    for (const l of lines) {
        if (ty > H - 130) break;
        ctx.fillText(l, 60, ty);
        ty += 34;
    }

    const statsY = H - 110;
    ctx.strokeStyle = '#2f3336';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, statsY - 20);
    ctx.lineTo(W - 60, statsY - 20);
    ctx.stroke();

    const time = Math.floor(Math.random() * 23) + 1;
    const minutes = Math.floor(Math.random() * 60);
    const timeStr = `${time}:${minutes.toString().padStart(2, '0')} ${Math.random() > 0.5 ? 'AM' : 'PM'} · Sep ${Math.floor(Math.random() * 28) + 1}, 2026`;

    const views = (Math.random() * 500 + 5).toFixed(1);
    const retweets = Math.floor(Math.random() * 300) + 5;
    const likes = Math.floor(Math.random() * 1500) + 10;

    ctx.fillStyle = '#71767b';
    ctx.font = '15px sans-serif';
    ctx.fillText(timeStr, 60, statsY);

    const statY = statsY + 40;
    ctx.fillStyle = '#71767b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${retweets}`, 60, statY);
    ctx.fillStyle = '#71767b';
    ctx.font = '15px sans-serif';
    ctx.fillText('Retweets', 95, statY);

    ctx.fillStyle = '#71767b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${likes}`, 220, statY);
    ctx.fillStyle = '#71767b';
    ctx.font = '15px sans-serif';
    ctx.fillText('Likes', 250, statY);

    ctx.fillStyle = '#71767b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${views}K`, 360, statY);
    ctx.fillStyle = '#71767b';
    ctx.font = '15px sans-serif';
    ctx.fillText('Views', 400, statY);

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'tweet',
    aliases: ['faketweet'],
    category: 'Fun',
    desc: 'Generate a fake X/Twitter post of your own text.\n.tweet <text>\n.tweet (reply to a message)',

    execute: async (sock, from, msg, args, perms) => {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);
        const command = rawText.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const argText = rawText.slice(prefix.length + command.length).trim();

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = contextInfo?.quotedMessage;

        let tweetText = null;

        if (argText) {
            tweetText = argText;
        } else if (quotedMsg) {
            tweetText =
            quotedMsg.conversation ||
            quotedMsg.extendedTextMessage?.text ||
            quotedMsg.imageMessage?.caption ||
            quotedMsg.videoMessage?.caption ||
            null;
        }

        if (!tweetText) {
            return sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ ✠ ≫─━─━─━╮\n` +
                `│    *FAKE TWEET*\n` +
                `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
                `│\n` +
                `│ ✗ .tweet <text>\n` +
                `│ ✗ Or reply to a text\n` +
                `│ ✗ with .tweet\n` +
                `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`
            }, { quoted: msg });
        }

        if (tweetText.length > 220) tweetText = tweetText.slice(0, 220) + '...';

        let name = await getSenderName(sock, msg);

        if (!name) {
            try {
                const meta = await sock.groupMetadata(from);
                const p = meta.participants.find(x =>
                x.id === senderJid ||
                x.phoneNumber === senderJid
                );
                if (p?.notify) name = p.notify;
                if (p?.name) name = p.name;
            } catch {}
        }

        if (!name) name = 'user';

        let imageSource = await getProfilePic(sock, senderJid);
        if (!imageSource) {
            const realJid = await resolveJid(sock, senderJid);
            imageSource = await getProfilePic(sock, realJid);
        }

        try {
            const buffer = await generateTweetCard(imageSource, name, tweetText);

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
            const tmpPath = path.join(TEMP_DIR, `tweet_${Date.now()}.png`);
            fs.writeFileSync(tmpPath, buffer);

            await sock.sendMessage(from, {
                image: fs.readFileSync(tmpPath),
                                   caption: `🐦 *FAKE TWEET*\n\nPosted by @${senderJid.split('@')[0]}`,
                                   mentions: [senderJid]
            }, { quoted: msg });

            setTimeout(() => {
                try { fs.unlinkSync(tmpPath); } catch {}
            }, 30000);
        } catch (err) {
            console.error('[tweet] error:', err.message);
            await sock.sendMessage(from, { text: '❌ Could not generate fake tweet.' }, { quoted: msg });
        }
    }
};
