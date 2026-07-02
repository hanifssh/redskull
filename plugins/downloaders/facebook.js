const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execFileAsync = promisify(execFile);
const TEMP_DIR = './temp';

module.exports = {
    name: 'facebook',
    aliases: ['fb'],
    description: 'Download Facebook video (public videos only)',
    category: 'Download',
    execute: async (sock, from, msg, args) => {
        const url = args && args.length > 0 ? args[0] : '';

        if (!url || (!url.includes('facebook.com/') && !url.includes('fb.watch/'))) {
            await sock.sendMessage(from, {
                text: `📘 *Facebook Video Downloader*\n\nUsage: .fb <facebook-video-url>\nExample: .fb https://fb.watch/...`
            });
            return;
        }

        await sock.sendMessage(from, { text: '📥 Downloading Facebook video… ⏳' });

        try {
            try {
                await execFileAsync('yt-dlp', ['--version']);
            } catch {
                return sock.sendMessage(from, {
                    text: '❌ *yt-dlp is not installed!*\n\nInstall it'
                });
            }

            await fs.mkdir(TEMP_DIR, { recursive: true });
            const sessionId = `fb_${Date.now()}`;
            const outputDir = path.join(TEMP_DIR, sessionId);
            await fs.mkdir(outputDir, { recursive: true });
            const outputTemplate = path.join(outputDir, '%(title).70s.%(ext)s');

            const downloadArgs = [
                url,
                '--no-playlist',
                '--format', 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]',
                '--no-warnings',
                '--restrict-filenames',
                '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
                '-o', outputTemplate,
            ];

            console.log(`📥 Downloading Facebook: ${url}`);
            await execFileAsync('yt-dlp', downloadArgs, { timeout: 120000 });

            const files = await fs.readdir(outputDir);
            const videoFile = files.find(f => f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mkv'));
            if (!videoFile) throw new Error('No video file found after download');

            const videoPath = path.join(outputDir, videoFile);
            const videoBuffer = await fs.readFile(videoPath);

            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: '✅ Downloaded'
            });

            for (const file of files) {
                await fs.unlink(path.join(outputDir, file)).catch(() => {});
            }
            await fs.rmdir(outputDir).catch(() => {});

        } catch (error) {
            console.error('❌ Facebook error:', error.message);
            await sock.sendMessage(from, {
                text: `❌ *Failed to download Facebook video.*\n\n${error.message}\n\nMake sure the video is **public** and the link is correct.`
            });
        }
    }
};
