const axios = require('axios');

module.exports = {
    name: 'tiktok',
    aliases: ['tt'],
    description: 'Download TikTok video without watermark (tikwm.com)',
    category: 'Download',
    execute: async (sock, from, msg, args) => {
        const url = args && args.length > 0 ? args[0] : '';

        if (!url || (!url.includes('tiktok.com/') && !url.includes('vm.tiktok.com/'))) {
            await sock.sendMessage(from, {
                text: `🎵 *TikTok Downloader*\n\nUsage: .tiktok <url>`
            });
            return;
        }

        await sock.sendMessage(from, { text: '📥 Downloading TikTok Content…' });

        try {
            const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
            const { data } = await axios.get(apiUrl, { timeout: 15000 });

            if (data.code !== 0 || !data.data?.play) {
                throw new Error('API did not return a video URL');
            }

            const videoUrl = data.data.play;

            const response = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            const videoBuffer = Buffer.from(response.data);

            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: 'video/mp4'
            });

        } catch (err) {
            console.error('[tiktok] Error:', err.message);
            await sock.sendMessage(from, {
                text: '❌ *Failed to download TikTok video.* The link may be invalid or TikTok is blocking the request.'
            });
        }
    }
};
