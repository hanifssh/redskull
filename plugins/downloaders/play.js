const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const execFileAsync = promisify(execFile);
const TEMP_DIR = './temp';

module.exports = {
  name: 'play',
  aliases:  ['song'],
  description: 'Search and download a song from YouTube',
  category: 'Download',
  execute: async (sock, from, msg, args) => {
    const query = args && args.length > 0 ? args.join(' ') : '';

    if (!query) {
      await sock.sendMessage(from, {
        text: `🎵 *Play Command*\n\nUsage: .play <song name>\nExample: .play Shape of You`
      });
      return;
    }

    await sock.sendMessage(from, {
      text: `🔍 *Searching for:* ${query}\n⏳ Please wait...`
    });

    try {
      const infoArgs = [
        `ytsearch1:${query}`,
        '--no-playlist',
        '--print', '%(title)s',
        '--print', '%(duration)s',
        '--print', '%(view_count)s',
        '--print', '%(uploader)s',
        '--print', '%(webpage_url)s',
        '--print', '%(thumbnail)s',
        '--skip-download',
        '--no-warnings',
        '--user-agent', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
        '--extractor-args', 'youtube:player_client=android',
      ];

      console.log(`🔍 Searching: ${query}`);
      const { stdout: infoOutput } = await execFileAsync('yt-dlp', infoArgs, { timeout: 600000 });
      const lines = infoOutput.trim().split('\n');

      if (lines.length < 6) {
        throw new Error('Could not find song details. Try a different query.');
      }

      const [title, duration, views, uploader, url, thumbnailUrl] = lines;
      console.log(`✅ Found: ${title}`);

      let caption = `🎵 *${title}*\n`;
      caption += `👤 *Artist:* ${uploader || 'Unknown'}\n`;
      caption += `⏱️ *Duration:* ${duration || 'Unknown'}s\n`;
      if (views) {
        caption += `👁️ *Views:* ${parseInt(views).toLocaleString()}\n`;
      }
      caption += `\n*Downloading your song...*`;

      try {
        const thumbResponse = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });
        const thumbBuffer = Buffer.from(thumbResponse.data);
        await sock.sendMessage(from, {
          image: thumbBuffer,
          caption: caption
        });
      } catch (thumbErr) {
        console.log('Thumbnail failed:', thumbErr.message);
        await sock.sendMessage(from, { text: caption });
      }

      await fs.mkdir(TEMP_DIR, { recursive: true });
      const sessionId = `play_${Date.now()}`;
      const outputDir = path.join(TEMP_DIR, sessionId);
      await fs.mkdir(outputDir, { recursive: true });
      const outputTemplate = path.join(outputDir, '%(title).70s.%(ext)s');

      const downloadArgs = [
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
        '--geo-bypass',
        '-o', outputTemplate,
      ];

      console.log(`📥 Downloading: ${url}`);
      await execFileAsync('yt-dlp', downloadArgs, { timeout: 600000 });

      const files = await fs.readdir(outputDir);
      const audioFile = files.find(f => f.endsWith('.mp3'));
      if (!audioFile) {
        throw new Error('Download failed. Could not find audio file.');
      }

      const audioPath = path.join(outputDir, audioFile);
      const audioBuffer = await fs.readFile(audioPath);

      await sock.sendMessage(from, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: title,
            body: uploader || 'Unknown Artist',
            mediaType: 1,
            showAdAttribution: false,
            renderLargerThumbnail: false,
            thumbnailUrl: thumbnailUrl || 'https://i.imgur.com/ho2Lhdv.jpeg',
          }
        }
      });

      for (const file of files) {
        await fs.unlink(path.join(outputDir, file)).catch(() => {});
      }
      await fs.rmdir(outputDir).catch(() => {});

    } catch (error) {
      console.error('❌ Play error:', error.message);
      console.error('❌ Full error:', error);

      try {
        await execFileAsync('yt-dlp', ['--version']);
      } catch {
        await sock.sendMessage(from, {
          text: `❌ *yt-dlp is not installed!*\n\nInstall it:\n\`pip install yt-dlp\``
        });
        return;
      }

      try {
        await execFileAsync('ffmpeg', ['-version']);
      } catch {
        await sock.sendMessage(from, {
          text: `❌ *ffmpeg is not installed!*\n\nInstall it:\n\`sudo apt install ffmpeg\` or \`sudo pacman -S ffmpeg\``
        });
        return;
      }

      await sock.sendMessage(from, {
        text: `❌ *Failed to play song*\n\n${error.message}\n\nTry: .play <song name>`
      });
    }
  }
};
