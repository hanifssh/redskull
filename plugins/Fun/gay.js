const { createCanvas, loadImage } = require('canvas');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');

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

function drawStripeFlag(ctx, x, y, w, h, colors) {
    const stripeH = h / colors.length;
    for (let i = 0; i < colors.length; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y + i * stripeH, w, stripeH + 1);
    }
}

function drawTrianglePrideFlag(ctx, cx, cy, size) {
    const colors = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'];
    const stripeH = size / colors.length;
    for (let i = 0; i < colors.length; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(cx - size / 2, cy - size / 2 + i * stripeH, size, stripeH + 1);
    }
}

async function generateGayCard(imageSource) {
    const W = 800;
    const H = 800;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#1a001a');
    bgGrad.addColorStop(0.25, '#001a1a');
    bgGrad.addColorStop(0.5, '#0d0d0d');
    bgGrad.addColorStop(0.75, '#1a1a00');
    bgGrad.addColorStop(1, '#1a001a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    const prideColors = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'];
    const stripeH = 8;
    for (let i = 0; i < prideColors.length; i++) {
        ctx.fillStyle = prideColors[i];
        ctx.fillRect(0, i * stripeH, W, stripeH);
        ctx.fillRect(0, H - (prideColors.length - i) * stripeH, W, stripeH);
    }

    for (let i = 0; i < prideColors.length; i++) {
        ctx.fillStyle = prideColors[i];
        ctx.fillRect(i * stripeH, 0, stripeH, H);
        ctx.fillRect(W - (prideColors.length - i) * stripeH, 0, stripeH, H);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRIDE', W / 2, 110);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ff99dd';
    ctx.fillText('CERTIFIED 🏳️‍🌈', W / 2, 145);

    const imgSize = 400;
    const imgY = 190;

    if (imageSource) {
        try {
            const img = await loadImage(imageSource);
            ctx.save();
            ctx.beginPath();
            ctx.arc(W / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            const scale = Math.max(imgSize / img.width, imgSize / img.height);
            const sw = img.width * scale;
            const sh = img.height * scale;
            const sx = W / 2 - sw / 2;
            const sy = imgY + imgSize / 2 - sh / 2;
            ctx.drawImage(img, sx, sy, sw, sh);
            ctx.restore();

            const ringColors = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'];
            const segAngle = (Math.PI * 2) / ringColors.length;
            const ringRadius = imgSize / 2 + 8;
            for (let i = 0; i < ringColors.length; i++) {
                ctx.strokeStyle = ringColors[i];
                ctx.lineWidth = 10;
                ctx.beginPath();
                ctx.arc(W / 2, imgY + imgSize / 2, ringRadius, i * segAngle - Math.PI / 2, (i + 1) * segAngle - Math.PI / 2);
                ctx.stroke();
            }
        } catch {
            ctx.fillStyle = '#2a0a2a';
            ctx.beginPath();
            ctx.arc(W / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff66cc';
            ctx.font = 'bold 80px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('?', W / 2, imgY + imgSize / 2 + 25);
        }
    } else {
        ctx.fillStyle = '#2a0a2a';
        ctx.beginPath();
        ctx.arc(W / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff66cc';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', W / 2, imgY + imgSize / 2 + 25);
    }

    const flagY = imgY + imgSize + 70;
    const flagW = 340;
    const flagH = 40;
    const flagX = (W - flagW) / 2;

    drawStripeFlag(ctx, flagX, flagY, flagW, flagH, prideColors);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(flagX, flagY, flagW, flagH);

    const flag2W = 340;
    const flag2H = 40;
    const flag2Y = flagY + flagH + 15;

    const transColors = ['#5bcefa', '#f5a9b8', '#ffffff', '#f5a9b8', '#5bcefa'];
    drawStripeFlag(ctx, flagX, flag2Y, flag2W, flag2H, transColors);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(flagX, flag2Y, flag2W, flag2H);

    const heartY = flag2Y + flag2H + 45;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff66cc';
    ctx.fillText('🏳️‍🌈 LOVE IS LOVE 🏳️‍🌈', W / 2, heartY);

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'gay',
    aliases: ['gay', 'lgbt'],
    category: 'Fun',
    desc: 'Add pride flags to someone.\n.gay @user\n.gay (reply to a photo)',

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
                `│    *PRIDE CARD*\n` +
                `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
                `│\n` +
                `│ ✗ .gay @user\n` +
                `│ ✗ Reply to a photo\n` +
                `│ ✗ with .gay\n` +
                `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`
            }, { quoted: msg });
        }

        const realJid = await resolveJid(sock, targetJid);

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
            const buffer = await generateGayCard(imageSource);

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
            const tmpPath = path.join(TEMP_DIR, `gay_${Date.now()}.png`);
            fs.writeFileSync(tmpPath, buffer);

            await sock.sendMessage(from, {
                image: fs.readFileSync(tmpPath),
                                   caption: `🏳️‍🌈 *CERTIFIED PRIDE* 🏳️‍🌈\n\n@${targetJid.split('@')[0]} is officially certified 🏳️‍🌈`,
                                   mentions: [targetJid]
            }, { quoted: msg });

            setTimeout(() => {
                try { fs.unlinkSync(tmpPath); } catch {}
            }, 30000);
        } catch (err) {
            console.error('[gay] error:', err.message);
            await sock.sendMessage(from, { text: '❌ Could not generate card.' }, { quoted: msg });
        }
    }
};
