const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const VARS_PATH = path.join(__dirname, '../../database/vars.json');

function readVars() {
    try { return JSON.parse(fs.readFileSync(VARS_PATH, 'utf8')); } catch { return {}; }
}
function writeVars(obj) {
    fs.mkdirSync(path.dirname(VARS_PATH), { recursive: true });
    fs.writeFileSync(VARS_PATH, JSON.stringify(obj, null, 2));
}

function unwrapEnvelopes(quoted) {
    if (!quoted) return null;
    const wrappers = [
        'viewOnceMessage',
        'viewOnceMessageV2',
        'viewOnceMessageV2Extension',
        'ephemeralMessage',
        'documentWithCaptionMessage'
    ];
    let current = quoted;
    let changed = true;
    let guard = 0;
    while (changed && guard < 10) {
        changed = false;
        for (const w of wrappers) {
            if (current[w]?.message) {
                current = current[w].message;
                changed = true;
                guard++;
                break;
            }
        }
    }
    return current;
}

function extractMedia(msg) {
    if (!msg) return null;
    for (const k of ['imageMessage', 'videoMessage', 'audioMessage']) {
        if (msg[k]) {
            return {
                media: msg[k],
                type: k === 'imageMessage' ? 'image' : k === 'videoMessage' ? 'video' : 'audio',
                key: k
            };
        }
    }
    return null;
}

async function downloadMedia(media, type) {
    const stream = await downloadContentFromMessage(media, type);
    let chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function sendRevealed(sock, target, info, buffer, quotedSender, msg) {
    const baseCaption =
    `╭━─━─━─≪ 👁️ ≫─━─━─━╮\n` +
    `│  *VIEW-ONCE REVEALED*\n` +
    `╰━─━─━─≪ 👁️ ≫─━─━─━╯\n` +
    `│\n` +
    `│ ✗ *From:* @${quotedSender.split('@')[0]}\n` +
    (info.media.caption ? `│ ✗ *Caption:* ${info.media.caption}\n` : '') +
    `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`;

    if (info.type === 'image') {
        await sock.sendMessage(target, {
            image: buffer,
            caption: baseCaption,
            mentions: [quotedSender]
        }, msg ? { quoted: msg } : {});
    } else if (info.type === 'video') {
        await sock.sendMessage(target, {
            video: buffer,
            caption: baseCaption,
            mentions: [quotedSender]
        }, msg ? { quoted: msg } : {});
    } else if (info.type === 'audio') {
        await sock.sendMessage(target, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            ptt: false
        }, msg ? { quoted: msg } : {});
    }
}

async function resolveOwnerJid(sock, senderJid) {
    if (!senderJid) return senderJid;
    if (senderJid.endsWith('@lid')) {
        try {
            const mapped = await sock.signalRepository?.lidMapping?.getPNForLID(senderJid);
            if (mapped) return mapped.split(':')[0].split('@')[0] + '@s.whatsapp.net';
        } catch {}
    }
    return senderJid;
}

module.exports = {
    name: 'vv',
    aliases: ['viewonce', 'reveal'],
    category: 'Tools',
    desc: 'Reveal a view-once message.\n.vv p → send to your DM\n.vv c → send to current chat\n.vv <keyword> → set custom trigger',

    execute: async (sock, from, msg, args, perms) => {
        if (!perms?.isOwner) {
            return;
        }

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const vars = readVars();

        const arg = args.join(' ').trim();

        if (!contextInfo?.quotedMessage) {
            if (arg === 'p' || arg === 'P') {
                const ownerJid = await resolveOwnerJid(sock, senderJid);
                vars.VV_MODE = 'p';
                vars.VV_OWNER = ownerJid;
                writeVars(vars);
                return sock.sendMessage(from, {
                    text: `✅ VV mode set to *private*.\nRevealed media will go to your DM (+${ownerJid.split('@')[0]}).`
                }, { quoted: msg });
            }

            if (arg === 'c' || arg === 'C') {
                vars.VV_MODE = 'c';
                vars.VV_OWNER = await resolveOwnerJid(sock, senderJid);
                writeVars(vars);
                return sock.sendMessage(from, {
                    text: `✅ VV mode set to *current chat*.\nRevealed media will be sent in this chat.`
                }, { quoted: msg });
            }

            if (arg) {
                vars.VV_KEYWORD = arg;
                if (!vars.VV_MODE) vars.VV_MODE = 'c';
                if (!vars.VV_OWNER) vars.VV_OWNER = await resolveOwnerJid(sock, senderJid);
                writeVars(vars);
                return sock.sendMessage(from, {
                    text: `✅ VV keyword set to: *${arg}*\nReply "${arg}" to any view-once message to reveal it.`
                }, { quoted: msg });
            }

            const currentMode = vars.VV_MODE === 'p' ? 'private (DM)' : 'current chat';
            const currentKw = vars.VV_KEYWORD || 'not set';
            return sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ ✠ ≫─━─━─━╮\n` +
                `│    *VIEW ONCE*\n` +
                `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
                `│\n` +
                `│ ✗ *.vv p* — send to DM\n` +
                `│ ✗ *.vv c* — send here\n` +
                `│ ✗ *.vv <keyword>* — set trigger\n` +
                `│ ✗ Reply keyword to any VV\n` +
                `│\n` +
                `│ _Mode: ${currentMode}_\n` +
                `│ _Keyword: ${currentKw}_\n` +
                `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`
            }, { quoted: msg });
        }

        const quoted = contextInfo.quotedMessage;
        const unwrapped = unwrapEnvelopes(quoted);
        let info = extractMedia(unwrapped);
        if (!info) info = extractMedia(quoted);

        if (!info) {
            return sock.sendMessage(from, {
                text: '❌ No view-once media found in the replied message.'
            }, { quoted: msg });
        }

        const quotedSender = contextInfo.participant || contextInfo.remoteJid || senderJid;
        const mode = vars.VV_MODE || 'c';
        const destination = mode === 'p' ? (vars.VV_OWNER || await resolveOwnerJid(sock, senderJid)) : from;

        try {
            const buffer = await downloadMedia(info.media, info.type);
            await sendRevealed(sock, destination, info, buffer, quotedSender, mode === 'p' ? null : msg);
        } catch (err) {
            console.error('[vv] error:', err.message);
            await sock.sendMessage(from, {
                text: '❌ Could not reveal. WhatsApp may have redacted this view-once media.'
            }, { quoted: msg });
        }
    }
};

(function vvKeywordListener() {
    if (!global.sock) return setTimeout(vvKeywordListener, 500);

    global.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const vars = readVars();
        if (!vars.VV_KEYWORD) return;

        const keyword = vars.VV_KEYWORD.toLowerCase();
        const ownerJid = vars.VV_OWNER;

        for (const msg of messages) {
            if (!msg.message) continue;
            if (msg.key.fromMe) continue;

            const from = msg.key.remoteJid;
            const senderJid = msg.key.participant || msg.key.remoteJid;

            if (ownerJid && senderJid !== ownerJid) continue;

            const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase();

            if (text !== keyword) continue;

            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            if (!contextInfo?.quotedMessage) continue;

            const quoted = contextInfo.quotedMessage;
            const unwrapped = unwrapEnvelopes(quoted);
            let info = extractMedia(unwrapped);
            if (!info) info = extractMedia(quoted);
            if (!info) continue;

            const quotedSender = contextInfo.participant || contextInfo.remoteJid || senderJid;
            const mode = vars.VV_MODE || 'c';
            const destination = mode === 'p' ? (vars.VV_OWNER || senderJid) : from;

            try {
                const buffer = await downloadMedia(info.media, info.type);
                await sendRevealed(global.sock, destination, info, buffer, quotedSender, mode === 'p' ? null : msg);
            } catch (err) {
                console.error('[vv] keyword reveal error:', err.message);
            }
        }
    });
})();
