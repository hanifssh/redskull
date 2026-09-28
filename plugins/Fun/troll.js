const { createCanvas, loadImage } = require('canvas');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');

function getRandomRoast() {
    const roasts = [
        'You look like the kind of person who says "trust me bro" and then proceeds to lose everything. Your whole vibe screams "I peaked at a school talent show that nobody watched."',
        'You have the confidence of a thousand men and the results of absolutely none. Every time you open your mouth, someone somewhere loses brain cells just by being near you.',
        'Your selfies have more filters than your personality has layers. You spend 40 minutes editing a pic just to get 3 likes, one of which is your mom and the other is your own alt account.',
        'You are the human version of "loading... please wait" that never actually loads. People wait for you to say something smart and they have been waiting since 2014.',
        'Bro really thinks he is the main character but he is the extra that gets cut in the first edit. You are background noise in a group project you did not even contribute to.',
        'You look like someone who argues with cashiers over expired coupons and then cries on the way home because they said no. Your whole life is a customer service complaint waiting to happen.',
        'Your whole personality is reposting memes you stole from Twitter and pretending you came up with them. Even your humor is borrowed, and you still somehow get the punchline wrong.',
        'You look like you pay for Discord Nitro and still nobody DMs you. Even the bots ignore your messages and they literally reply to everyone.',
        'Bro got the kind of face that makes babies cry and mothers apologize to the babies. Your existence is proof that even nature has off days.',
        'You look like you got rejected by a vending machine and then wrote a sad post about it. Your whole life is a series of Ls that you pretend are Ws.',
        'You have that "I still live with my mom and blame the economy" energy. Every time someone asks what you do for a living, you change the subject to crypto.',
        'Your dating life is a bigger L than your selfies, and your selfies are already at rock bottom. You send "hey" 47 times to the same person and wonder why they blocked you.',
        'You look like the type to lose a fight with a paper bag and then post about it on social media for sympathy. Your whole presence is a red flag in human form.',
        'Bro has the attention span of a goldfish and the memory of a broken USB. You forgot what you were saying mid-sentence and blamed it on ADHD you do not have.',
        'You are the human equivalent of a 404 error that keeps showing up when nobody asked. Every time you enter a chat, someone leaves.',
        'Your face is the reason people invented filters, and even the strongest filter gave up on you. You look like a mugshot from a crime you did not commit but definitely would.',
        'You look like the kind of person who says "I am not like other guys" and then proceeds to be exactly like every other guy. You are a template, not a person.',
        'Bro really thinks he is different but he is the same NPC with a different skin. You bring absolutely nothing to any conversation except the sound of your own voice.',
        'You look like someone who peaked in high school and still brings up the one time they scored a goal in PE. Your glory days are older than some of your friends.',
        'Your entire existence is a skill issue and everyone around you is just too polite to say it. You are the reason group chats go silent when you start typing.'
    ];
    return roasts[Math.floor(Math.random() * roasts.length)];
}

async function generateTrollCard(imageSource, name) {
    const W = 700;
    const H = 900;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#200000');
    grad.addColorStop(0.5, '#0a0a0a');
    grad.addColorStop(1, '#200000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#ff1a1a';
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, W - 30, H - 30);

    ctx.strokeStyle = '#660000';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, W - 56, H - 56);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TROLLED', W / 2, 100);

    ctx.fillStyle = '#ff1a1a';
    ctx.fillRect(W / 2 - 160, 122, 320, 4);

    const imgSize = 360;
    const imgY = 175;

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

            ctx.strokeStyle = '#ff1a1a';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(W / 2, imgY + imgSize / 2, imgSize / 2 + 2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(W / 2, imgY + imgSize / 2, imgSize / 2 + 12, 0, Math.PI * 2);
            ctx.stroke();
        } catch {
            ctx.fillStyle = '#2a0000';
            ctx.beginPath();
            ctx.arc(W / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff1a1a';
            ctx.font = 'bold 80px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('?', W / 2, imgY + imgSize / 2 + 25);
        }
    } else {
        ctx.fillStyle = '#2a0000';
        ctx.beginPath();
        ctx.arc(W / 2, imgY + imgSize / 2, imgSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff1a1a';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', W / 2, imgY + imgSize / 2 + 25);
    }

    const roast = getRandomRoast();

    ctx.fillStyle = '#e0e0e0';
    ctx.font = 'italic 20px sans-serif';
    const words = roast.split(' ');
    const lines = [];
    let line = '';
    const maxW = W - 100;
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

    const startY = imgY + imgSize + 60;
    let ry = startY;
    for (const l of lines) {
        ctx.fillText(l, W / 2, ry);
        ry += 30;
    }

    return canvas.toBuffer('image/png');
}

async function getProfilePic(sock, jid) {
    try {
        return await sock.profilePictureUrl(jid, 'image', 10000);
    } catch {
        return null;
    }
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

module.exports = {
    name: 'troll',
    aliases: ['trollcard','troll'],
    category: 'Fun',
    desc: 'Generate a troll card.\n.troll @user\n.troll (reply to photo)',

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
                `│    *TROLL CARD*\n` +
                `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
                `│\n` +
                `│ ✗ .troll @user\n` +
                `│ ✗ Reply to a photo\n` +
                `│ ✗ with .troll\n` +
                `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`
            }, { quoted: msg });
        }

        const realJid = await resolveJid(sock, targetJid);
        const name = await getName(sock, from, realJid) || 'Trolled';

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
            const buffer = await generateTrollCard(imageSource, name);

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
            const tmpPath = path.join(TEMP_DIR, `troll_${Date.now()}.png`);
            fs.writeFileSync(tmpPath, buffer);

            await sock.sendMessage(from, {
                image: fs.readFileSync(tmpPath),
                                   caption: `🤡 *TROLLED* 🤡\n\n@${targetJid.split('@')[0]} just got cooked 💀`,
                                   mentions: [targetJid]
            }, { quoted: msg });

            setTimeout(() => {
                try { fs.unlinkSync(tmpPath); } catch {}
            }, 30000);
        } catch (err) {
            console.error('[troll] error:', err.message);
            await sock.sendMessage(from, { text: '❌ Could not generate troll card.' }, { quoted: msg });
        }
    }
};
