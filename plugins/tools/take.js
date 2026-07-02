const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const Sticker = require('wa-sticker-formatter');

module.exports = {
    name: 'take',
    aliases: ['steal'],
    category: 'Tools',
    desc: 'Change sticker metadata. Reply to a sticker with .take or .take <name>',

    execute: async (sock, from, msg, args) => {
        try {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
            msg.message?.stickerMessage?.contextInfo;
            if (!contextInfo?.quotedMessage) {
                return sock.sendMessage(from, { text: '❌ Please reply to a sticker.' });
            }

            const quoted = contextInfo.quotedMessage;
            const media = quoted.stickerMessage;
            if (!media) {
                return sock.sendMessage(from, { text: '❌ Replied message is not a sticker.' });
            }

            const argString = Array.isArray(args) ? args.join(' ') : (typeof args === 'string' ? args : '');
            const senderName = (msg.pushName && msg.pushName.trim()) ? msg.pushName.trim() : 'REDSKULL';
            const packName = argString.trim() || senderName;

            let buffer;
            try {
                const stream = await downloadContentFromMessage(media, 'sticker');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                buffer = Buffer.concat(chunks);
            } catch (err) {
                console.error('[take] download error:', err.message);
                return sock.sendMessage(from, { text: '❌ Could not download sticker.' });
            }

            if (!buffer || buffer.length < 100) {
                return sock.sendMessage(from, { text: '❌ Downloaded sticker is too small.' });
            }

            let stickerBuf;
            try {
                const webpSticker = new Sticker.Sticker(buffer, {
                    pack: packName + '\n',   // WhatsApp shows pack name at the top
                    author: undefined,
                    type: 'full',
                    quality: 60,
                });
                stickerBuf = await webpSticker.toBuffer();
            } catch (exifErr) {
                console.error('[take EXIF error]:', exifErr);
                stickerBuf = buffer;
            }

            const isAnimated = media.isAnimated || false;
            await sock.sendMessage(from, {
                sticker: stickerBuf,
                ...(isAnimated && { isAnimated: true })
            });

        } catch (err) {
            console.error('[take]', err);
            await sock.sendMessage(from, { text: '❌ Failed to take sticker.' });
        }
    }
};
