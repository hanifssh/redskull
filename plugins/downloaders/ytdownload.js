const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const execFileAsync = promisify(execFile);
const TEMP_DIR = './temp';

if (!global.pendingYtDownload) global.pendingYtDownload = new Map();
const PENDING_EXPIRE = 5 * 60 * 1000;

(function attachYtChoiceListener() {
    if (!global.sock) return setTimeout(attachYtChoiceListener, 500);
    global.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const sender = msg.key.participant || msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const choice = text.trim();

            if ((choice === '1' || choice === '2') && global.pendingYtDownload.has(sender)) {
                const pending = global.pendingYtDownload.get(sender);
                if (Date.now() - pending.timestamp > PENDING_EXPIRE) {
                    global.pendingYtDownload.delete(sender);
                    continue;
                }
                await processDownload(pending.chatJid, pending, choice === '1');
                global.pendingYtDownload.delete(sender);
                return;
            }
        }
    });
})();

async function processDownload(chatJid, pending, wantVideo) {
    const { url, title, thumbnailUrl, uploader, duration, views } = pending;
    const sock = global.sock;
    if (!sock) return;

    await sock.sendMessage(chatJid, { text: `📥 Downloading *${wantVideo ? 'video' : 'audio'}* of *${title}*…` });

    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        const sessionId = `ytdl_${Date.now()}`;
        const outputDir = path.join(TEMP_DIR, sessionId);
        await fs.mkdir(outputDir, { recursive: true });
        const outputTemplate = path.join(outputDir, '%(title).70s.%(ext)s');

        if (wantVideo) {
            const videoArgs = [
                url,
                '--no-playlist',
                '-f', 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]',
                '--no-warnings',
                '--restrict-filenames',
                '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
                '--extractor-args', 'youtube:player_client=android',
                '-o', outputTemplate,
            ];
            await execFileAsync('yt-dlp', videoArgs, { timeout: 120000 });

            const files = await fs.readdir(outputDir);
            const videoFile = files.find(f => f.endsWith('.mp4'));
            if (!videoFile) throw new Error('No video file found');

            const videoBuffer = await fs.readFile(path.join(outputDir, videoFile));
            await sock.sendMessage(chatJid, {
                video: videoBuffer,
                caption: `🎬 *${title}*\n👤 ${uploader || 'Unknown'} | ⏱ ${duration || '?'}s | 👁 ${views ? parseInt(views).toLocaleString() : '?'}`,
                                   mimetype: 'video/mp4',
            });
        } else {
            const audioArgs = [
                url,
                '--no-playlist',
                '--extract-audio',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '--embed-thumbnail',
                '--add-metadata',
                '--no-warnings',
                '--restrict-filenames',
                '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
                '--extractor-args', 'youtube:player_client=android',
                '-o', outputTemplate,
            ];
            await execFileAsync('yt-dlp', audioArgs, { timeout: 120000 });

            const files = await fs.readdir(outputDir);
            const audioFile = files.find(f => f.endsWith('.mp3'));
            if (!audioFile) throw new Error('No audio file found');

            const audioBuffer = await fs.readFile(path.join(outputDir, audioFile));
            await sock.sendMessage(chatJid, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: title,
                        body: uploader || 'Unknown Artist',
                        mediaType: 1,
                        showAdAttribution: false,
                        thumbnailUrl: thumbnailUrl || 'https://i.imgur.com/ho2Lhdv.jpeg',
                    }
                }
            });
        }

        const dirFiles = await fs.readdir(outputDir);
        for (const f of dirFiles) await fs.unlink(path.join(outputDir, f)).catch(() => {});
        await fs.rmdir(outputDir).catch(() => {});

    } catch (error) {
        console.error('[ytdownload] download error:', error);
        await sock.sendMessage(chatJid, { text: `❌ Download failed: ${error.message}\nYou can try the other format by replying 1 or 2.` });
    }
}

module.exports = {
    name: 'ytdownload',
    aliases: ['ytdl'],
    description: 'Download YouTube video/audio. .ytdownload <link> then reply 1 or 2',
    category: 'Download',
    execute: async (sock, from, msg, args) => {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);
        const parts = rawText.slice(prefix.length).trim().split(/\s+/);
        const command = parts.shift().toLowerCase();
        const arg = parts.join(' ').trim();

        if (arg === '1' || arg === '2') {
            const pending = global.pendingYtDownload.get(senderJid);
            if (!pending || Date.now() - pending.timestamp > PENDING_EXPIRE) {
                global.pendingYtDownload.delete(senderJid);
                return sock.sendMessage(from, { text: '❌ No pending download. Use `.ytdownload <link>` first.' });
            }
            await processDownload(from, pending, arg === '1');
            global.pendingYtDownload.delete(senderJid);
            return;
        }

        if (!arg || (!arg.includes('youtube.com/') && !arg.includes('youtu.be/'))) {
            return sock.sendMessage(from, {
                text: `📥 *YouTube Downloader*\n\nUsage:\n1. \`${prefix}ytdownload <youtube link>\`\n2. When asked, reply *1* (video) or *2* (audio)`
            });
        }

        const url = arg;
        global.pendingYtDownload.delete(senderJid);

        await sock.sendMessage(from, { text: '🔍 Fetching video info…' });

        try {
            const infoArgs = [
                url,
                '--no-playlist',
                '--print', '%(title)s',
                '--print', '%(duration)s',
                '--print', '%(view_count)s',
                '--print', '%(uploader)s',
                '--print', '%(thumbnail)s',
                '--skip-download',
                '--no-warnings',
                '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
                '--extractor-args', 'youtube:player_client=android',
            ];

            const { stdout } = await execFileAsync('yt-dlp', infoArgs, { timeout: 30000 });
            const lines = stdout.trim().split('\n');
            if (lines.length < 5) throw new Error('Could not retrieve video info.');

            const [title, duration, views, uploader, thumbnailUrl] = lines;

            global.pendingYtDownload.set(senderJid, {
                url,
                title,
                thumbnailUrl,
                uploader,
                duration,
                views,
                chatJid: from,
                timestamp: Date.now(),
            });

            let caption = `🎬 *${title}*\n`;
            caption += `👤 *Channel:* ${uploader || 'Unknown'}\n`;
            caption += `⏱ *Duration:* ${duration || '?'}s\n`;
            if (views) caption += `👁 *Views:* ${parseInt(views).toLocaleString()}\n`;
            caption += `\nChoose format:\n`;
            caption += `Reply *1* for video (mp4)\n`;
            caption += `Reply *2* for audio (mp3)`;

            try {
                const thumbResp = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });
                const thumbBuffer = Buffer.from(thumbResp.data);
                await sock.sendMessage(from, { image: thumbBuffer, caption });
            } catch {
                await sock.sendMessage(from, { text: caption });
            }
        } catch (infoError) {
            console.error('[ytdownload] info error:', infoError);
            await sock.sendMessage(from, { text: `❌ Failed to fetch video info. Is the link valid?\n${infoError.message}` });
        }
    }
};
