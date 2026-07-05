const { execFile, execSync } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const ffmpegStatic = require('ffmpeg-static');

const execFileAsync = promisify(execFile);
const TEMP_DIR = './temp';

function getFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    return ffmpegStatic;
  }
}

module.exports = {
  name: 'play',
  aliases: ['song'],
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

    let videoInfo = null;

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
      const { stdout } = await execFileAsync('yt-dlp', infoArgs, { timeout: 60000 });
      const lines = stdout.trim().split('\n');

      if (lines.length >= 6) {
        videoInfo = {
          title: lines[0],
          duration: lines[1],
          views: lines[2],
          uploader: lines[3],
          url: lines[4],
          thumbnailUrl: lines[5],
        };
      }
    } catch (ytdlpErr) {
      console.log('[play] yt-dlp search failed, trying ytdl-core...');
    }

    if (!videoInfo) {
      try {
        const search = await yts(query);
        if (search.videos && search.videos.length > 0) {
          const video = search.videos[0];
          videoInfo = {
            title: video.title,
            duration: video.duration?.timestamp || '0',
            views: video.views || 0,
            uploader: video.author?.name || 'Unknown',
            url: video.url,
            thumbnailUrl: video.thumbnail,
          };
        }
      } catch (ytdlCoreErr) {
        console.error('[play] ytdl-core search also failed');
      }
    }

    if (!videoInfo) {
      return sock.sendMessage(from, {
        text: '❌ *Could not find the song.*\n\nTry a different search term.'
      });
    }

    const { title, duration, views, uploader, url, thumbnailUrl } = videoInfo;
    console.log(`✅ Found: ${title}`);

    let caption = `🎵 *${title}*\n`;
    caption += `👤 *Artist:* ${uploader || 'Unknown'}\n`;
    caption += `⏱️ *Duration:* ${duration || 'Unknown'}s\n`;
    if (views) caption += `👁️ *Views:* ${parseInt(views).toLocaleString()}\n`;
    caption += `\n*Downloading your song...*`;

    try {
      const thumbResponse = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });
      await sock.sendMessage(from, { image: Buffer.from(thumbResponse.data), caption });
    } catch {
      await sock.sendMessage(from, { text: caption });
    }

    try {
      let audioBuffer;

      try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        const sessionId = `play_${Date.now()}`;
        const outputDir = path.join(TEMP_DIR, sessionId);
        await fs.mkdir(outputDir, { recursive: true });
        const outputTemplate = path.join(outputDir, '%(title).70s.%(ext)s');

        const ffmpeg = getFfmpeg();
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
          '--ffmpeg-location', ffmpeg,
          '-o', outputTemplate,
        ];

        console.log(`📥 Downloading: ${url}`);
        await execFileAsync('yt-dlp', downloadArgs, { timeout: 120000 });

        const files = await fs.readdir(outputDir);
        const audioFile = files.find(f => f.endsWith('.mp3'));
        if (!audioFile) throw new Error('No audio file found');

        audioBuffer = await fs.readFile(path.join(outputDir, audioFile));

        for (const file of files) {
          await fs.unlink(path.join(outputDir, file)).catch(() => {});
        }
        await fs.rmdir(outputDir).catch(() => {});
      } catch (ytdlpDownloadErr) {
        console.log('[play] yt-dlp download failed, trying ytdl-core...');
        const stream = ytdl(url, {
          filter: 'audioonly',
          quality: 'highestaudio',
          highWaterMark: 1024 * 1024 * 10,
        });
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        audioBuffer = Buffer.concat(chunks);
      }

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
    } catch (error) {
      console.error('❌ Play error:', error.message);
      await sock.sendMessage(from, {
        text: '❌ *Failed to play the song.*\n\nYouTube may be blocking the request. Try again later or use a different search term.'
      });
    }
  }
};
