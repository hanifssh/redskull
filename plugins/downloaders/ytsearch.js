const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const execFileAsync = promisify(execFile);
const TEMP_DIR = './temp';

if (!global.pendingYtSearch) global.pendingYtSearch = new Map();
const SEARCH_EXPIRE = 3 * 60 * 1000;

(function attachSearchListener() {
    if (!global.sock) return setTimeout(attachSearchListener, 500);
    global.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const sender = msg.key.participant || msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const choice = text.trim();
            const num = parseInt(choice);

            if (num >= 1 && num <= 10 && global.pendingYtSearch.has(sender)) {
                const pending = global.pendingYtSearch.get(sender);
                if (Date.now() - pending.timestamp > SEARCH_EXPIRE) {
                    global.pendingYtSearch.delete(sender);
                    continue;
                }
                if (num > pending.results.length) continue;

                const video = pending.results[num - 1];

                await global.sock.sendMessage(pending.chatJid, {
                    text: `🎬 *${video.title}*\n👤 ${video.uploader || 'Unknown'} | ⏱ ${video.duration || '?'}s\n\nChoose format:\nReply *1* for video (mp4)\nReply *2* for audio (mp3)`
                });

                const choiceKey = `${sender}_choice`;
                global.pendingYtSearch.set(choiceKey, {
                    url: video.url,
                    title: video.title,
                    uploader: video.uploader,
                    duration: video.duration,
                    thumbnailUrl: video.thumbnailUrl,
                    chatJid: pending.chatJid,
                    timestamp: Date.now(),
                });
                global.pendingYtSearch.delete(sender);
                return;
            }

            const choiceKey2 = `${sender}_choice`;
            if ((text === '1' || text === '2') && global.pendingYtSearch.has(choiceKey2)) {
                const pending = global.pendingYtSearch.get(choiceKey2);
                if (Date.now() - pending.timestamp > SEARCH_EXPIRE) {
                    global.pendingYtSearch.delete(choiceKey2);
                    continue;
                }
                const wantVideo = text === '1';
                await processSearchDownload(pending.chatJid, pending, wantVideo);
                global.pendingYtSearch.delete(choiceKey2);
                return;
            }
        }
    });
})();

async function processSearchDownload(chatJid, info, wantVideo) {
    const sock = global.sock;
    if (!sock) return;

    const { url, title, uploader, duration, thumbnailUrl } = info;
    await sock.sendMessage(chatJid, { text: `📥 Downloading *${wantVideo ? 'video' : 'audio'}* of *${title}*…` });

    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        const sessionId = `ytsearch_${Date.now()}`;
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
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
                caption: `🎬 *${title}*\n👤 ${uploader || 'Unknown'} | ⏱ ${duration || '?'}s`,
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
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
        console.error('[ytsearch] download error:', error);
        await sock.sendMessage(chatJid, { text: '❌ *Download failed.*\n\nPlease try again later.' });
    }
}

module.exports = {
    name: 'ytsearch',
    aliases: ['yts'],
    description: 'Search YouTube and choose a result. .ytsearch <query>',
    category: 'Download',
    execute: async (sock, from, msg, args) => {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const query = args.join(' ').trim();

        if (!query) {
            return sock.sendMessage(from, {
                text: `🔍 *YouTube Search*\n\nUsage: .ytsearch <query>\nExample: .ytsearch lofi hip hop`
            }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: `🔍 *Searching YouTube for:* ${query}\n⏳ Please wait...` }, { quoted: msg });

        try {
            const infoArgs = [
                `ytsearch10:${query}`,
                '--no-playlist',
                '--print', '%(title)s',
                '--print', '%(duration)s',
                '--print', '%(uploader)s',
                '--print', '%(webpage_url)s',
                '--print', '%(thumbnail)s',
                '--skip-download',
                '--no-warnings',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                '--extractor-args', 'youtube:player_client=android',
            ];

            const { stdout } = await execFileAsync('yt-dlp', infoArgs, { timeout: 80000 });
            const lines = stdout.trim().split('\n');
            if (lines.length < 5) throw new Error('No results found');

            const results = [];
            for (let i = 0; i < lines.length; i += 5) {
                if (i + 4 >= lines.length) break;
                const videoUrl = lines[i + 3] || '';
                let thumbnailUrl = '';
                if (videoUrl.includes('watch?v=')) {
                    const vidId = videoUrl.split('v=')[1].split('&')[0];
                    thumbnailUrl = `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
                }
                results.push({
                    title: lines[i],
                    duration: lines[i + 1] || '?',
                    uploader: lines[i + 2] || 'Unknown',
                    url: videoUrl,
                    thumbnailUrl: lines[i + 4] || thumbnailUrl,
                });
            }

            if (results.length === 0) throw new Error('No valid results');

            global.pendingYtSearch.set(senderJid, {
                results,
                chatJid: from,
                timestamp: Date.now(),
            });

            let text = `🔍 *Search Results for:* ${query}\n\n`;
            results.forEach((r, i) => {
                text += `*${i + 1}.* ${r.title}\n    👤 ${r.uploader} | ⏱ ${r.duration}\n\n`;
            });
            text += `_Reply with a number (1‑10) to select a video._\n_Expires in 3 minutes._`;

            await sock.sendMessage(from, { text }, { quoted: msg });

        } catch (error) {
            console.error('[ytsearch] error:', error);
            await sock.sendMessage(from, {
                text: `❌ *Search failed.*\n\n${error.message}\n\nTry a different query.`
            }, { quoted: msg });
        }
    }
};
