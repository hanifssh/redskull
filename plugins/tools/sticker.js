const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const Sticker = require('wa-sticker-formatter');

module.exports = {
    name: 'sticker',
    aliases: ['s'],
    category: 'Tools',
    desc: 'Create a sticker from a replied image/video.\n.sticker → original ratio\n.sticker 1:1 → square',

    execute: async (sock, from, msg, args) => {
        try {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
            msg.message?.imageMessage?.contextInfo ||
            msg.message?.videoMessage?.contextInfo;
            if (!contextInfo?.quotedMessage) {
                return sock.sendMessage(from, { text: '❌ Please reply to an image or video.' });
            }

            const quoted = contextInfo.quotedMessage;
            const media = quoted.imageMessage || quoted.videoMessage;
            if (!media) {
                return sock.sendMessage(from, { text: '❌ Replied message is not an image or video.' });
            }

            const isVideo = !!quoted.videoMessage;

            const argString = Array.isArray(args) ? args.join(' ') : (typeof args === 'string' ? args : '');
            const square = argString.trim() === '1:1';

            const senderName = (msg.pushName && msg.pushName.trim()) ? msg.pushName.trim() : 'REDSKULL';

            let buffer;
            try {
                const stream = await downloadContentFromMessage(media, isVideo ? 'video' : 'image');
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                buffer = Buffer.concat(chunks);
            } catch (err) {
                console.error('[sticker] download error:', err.message);
                return sock.sendMessage(from, { text: '❌ Could not download media.' });
            }

            if (!buffer || buffer.length < 100) {
                return sock.sendMessage(from, { text: '❌ Downloaded media is too small.' });
            }

            const tmpDir = path.join(__dirname, '../../temp');
            fs.mkdirSync(tmpDir, { recursive: true });
            const inputFile = path.join(tmpDir, `sticker_${Date.now()}.${isVideo ? 'mp4' : 'png'}`);
            const outputFile = path.join(tmpDir, `sticker_${Date.now()}.webp`);
            fs.writeFileSync(inputFile, buffer);

            const padFilter = `scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000,setsar=1`;
            const cropFilter = `crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,setsar=1`;
            const finalFilter = square ? cropFilter : padFilter;

            const timeLimit = isVideo ? '-t 7 -r 15 ' : '';

            try {
                execSync(`ffmpeg -y -i "${inputFile}" ${timeLimit}-vf "${finalFilter}" -pix_fmt yuva420p -vcodec libwebp -lossless 0 -q:v 60 "${outputFile}"`, { stdio: 'ignore' });
            } catch (e) {
                console.error(e);
                return sock.sendMessage(from, { text: '❌ Failed to create sticker (ffmpeg error).' });
            }

            const rawStickerBuf = fs.readFileSync(outputFile);

            let stickerBuf;
            try {
                const webpSticker = new Sticker.Sticker(rawStickerBuf, {
                    pack: senderName,
                    author: undefined,
                    type: 'full',
                    quality: 60
                });
                stickerBuf = await webpSticker.toBuffer();
            } catch (exifErr) {
                console.error('[sticker EXIF error]:', exifErr);
                stickerBuf = rawStickerBuf;
            }

            await sock.sendMessage(from, {
                sticker: stickerBuf,
                ...(isVideo && { isAnimated: true })
            });

            try { fs.unlinkSync(inputFile); } catch {}
            try { fs.unlinkSync(outputFile); } catch {}
        } catch (err) {
            console.error('[sticker]', err);
            await sock.sendMessage(from, { text: '❌ Failed to create sticker.' });
        }
    }
};

