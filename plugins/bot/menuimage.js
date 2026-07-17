const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const ASSETS_DIR = path.join(__dirname, '../../assets');
const VARS_PATH = path.join(__dirname, '../../database/vars.json');

function readVars() {
    try { return JSON.parse(fs.readFileSync(VARS_PATH, 'utf8')); } catch { return {}; }
}
function writeVars(obj) {
    fs.mkdirSync(path.dirname(VARS_PATH), { recursive: true });
    fs.writeFileSync(VARS_PATH, JSON.stringify(obj, null, 2));
}

module.exports = {
    name: 'menuimage',
    aliases: ['setmenu'],
    category: 'Bot',
    desc: 'Set a custom image/GIF for the .menu command. Reply to an image/video with .menuimage.',
    ownerOnly: true,

    execute: async (sock, from, msg, args) => {
        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);
        const parts = rawText.slice(prefix.length).trim().split(/\s+/);
        parts.shift();
        const sub = parts[0]?.toLowerCase();

        if (sub === 'false') {
            const vars = readVars();
            delete vars.MENU_IMAGE_PATH;
            vars.MENU_IMAGE_TYPE = 'off';
            writeVars(vars);
            return sock.sendMessage(from, { text: '✅ Menu image disabled. The menu will be plain text.' }, { quoted: msg });
        }

        if (sub === 'true') {
            const vars = readVars();
            if (!vars.MENU_IMAGE_PATH) {
                return sock.sendMessage(from, { text: '❌ No previous menu image found. Set one first by replying to an image/GIF with `.menuimage`.' }, { quoted: msg });
            }
            vars.MENU_IMAGE_TYPE = vars.LAST_MENU_TYPE || 'static';
            writeVars(vars);
            const msgText = vars.MENU_IMAGE_TYPE === 'gif'
            ? '✅ Menu image enabled. The last used GIF will be shown.'
            : '✅ Menu image enabled. The last used static image will be shown.';
            return sock.sendMessage(from, { text: msgText }, { quoted: msg });
        }

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo;
        if (!contextInfo?.quotedMessage) {
            return sock.sendMessage(from, {
                text: `❌ Reply to an image or GIF with \`${prefix}menuimage\` to set it.\n` +
                `• \`${prefix}menuimage false\` → no image in menu\n` +
                `• \`${prefix}menuimage true\` → restore last used image`
            }, { quoted: msg });
        }

        const quoted = contextInfo.quotedMessage;
        const media = quoted.imageMessage || quoted.videoMessage;
        if (!media) return sock.sendMessage(from, { text: '❌ The replied message is not an image or video.' }, { quoted: msg });

        const isVideo = !!quoted.videoMessage;
        const isGif = media.mimetype === 'image/gif' || (quoted.imageMessage && quoted.imageMessage.gifAttribution);

        let buffer;
        try {
            const stream = await downloadContentFromMessage(media, isVideo ? 'video' : 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            buffer = Buffer.concat(chunks);
        } catch (err) {
            console.error('[menuimage] download error:', err.message);
            return sock.sendMessage(from, { text: '❌ Could not download the media.' }, { quoted: msg });
        }

        if (!buffer || buffer.length < 100) {
            return sock.sendMessage(from, { text: '❌ Downloaded media is too small.' }, { quoted: msg });
        }

        const mimeType = media.mimetype || '';
        let ext = '.jpeg';
        if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('jpg') || mimeType.includes('jpeg')) ext = '.jpeg';
        else if (mimeType.includes('webp')) ext = '.webp';
        else if (mimeType.includes('gif')) ext = '.gif';
        else if (isVideo) ext = '.mp4';

        const fileName = `menu_img_${Date.now()}${ext}`;
        const filePath = path.join(ASSETS_DIR, fileName);

        try {
            fs.writeFileSync(filePath, buffer);

            const vars = readVars();
            if (vars.MENU_IMAGE_PATH) {
                try { fs.unlinkSync(vars.MENU_IMAGE_PATH); } catch {}
            }

            const type = (isVideo || isGif) ? 'gif' : 'static';
            vars.MENU_IMAGE_PATH = filePath;
            vars.MENU_IMAGE_TYPE = type;
            vars.LAST_MENU_TYPE = type;
            writeVars(vars);

            await sock.sendMessage(from, {
                text: type === 'gif' ? '✅ Animated menu image set!' : '✅ Static menu image updated!'
            }, { quoted: msg });
        } catch (err) {
            console.error('[menuimage] write error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to save the image.' }, { quoted: msg });
        }
    }
};
