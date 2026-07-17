const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const execFileAsync = promisify(execFile);
const TEMP_DIR = './temp';

module.exports = {
  name: 'play',
  aliases: ['song'],
  description: 'Search and download a song from YouTube',
  category: 'Download',
  execute: async (sock, from, msg, args) => {
    const query = args.join(' ').trim();
    if (!query) {
      return sock.sendMessage(from, {
        text: `🎵 *Play Command*\n\nUsage: .play <song name>\nExample: .play Shape of You`
      }, { quoted: msg });
    }

    await sock.sendMessage(from, { text: `🔍 *Searching for:* ${query}\n⏳ Please wait...` }, { quoted: msg });

    try {
      const infoArgs = [
        `ytsearch1:${query}`,
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

      const { stdout } = await execFileAsync('yt-dlp', infoArgs, { timeout: 60000 });
      const lines = stdout.trim().split('\n');
      if (lines.length < 5) throw new Error('No results found');

      const title = lines[0];
      const duration = lines[1] || '?';
      const uploader = lines[2] || 'Unknown';
      const url = lines[3];
      const thumbnailUrl = lines[4] || '';

      let caption = `🎵 *${title}*\n`;
      caption += `👤 *Artist:* ${uploader}\n`;
      caption += `⏱️ *Duration:* ${duration}s\n`;
      caption += `\n📥 *Downloading your song...*`;

      try {
        const thumbResponse = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });
        await sock.sendMessage(from, { image: Buffer.from(thumbResponse.data), caption }, { quoted: msg });
      } catch {
        await sock.sendMessage(from, { text: caption }, { quoted: msg });
      }

      await fs.mkdir(TEMP_DIR, { recursive: true });
      const sessionId = `play_${Date.now()}`;
      const outputDir = path.join(TEMP_DIR, sessionId);
      await fs.mkdir(outputDir, { recursive: true });
      const outputTemplate = path.join(outputDir, '%(title).70s.%(ext)s');

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

      for (const file of files) {
        await fs.unlink(path.join(outputDir, file)).catch(() => {});
      }
      await fs.rmdir(outputDir).catch(() => {});

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
            thumbnailUrl: thumbnailUrl || 'https://i.imgur.com/ho2Lhdv.jpeg',
          }
        }
      }, { quoted: msg });

    } catch (error) {
      console.error('[play] error:', error.message);
      await sock.sendMessage(from, {
        text: '❌ *Failed to play the song.*\n\nTry a different search term or check if yt-dlp is installed.'
      }, { quoted: msg });
    }
  }
};
