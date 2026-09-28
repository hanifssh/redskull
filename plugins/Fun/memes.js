const axios = require('axios');

async function fetchMeme(subreddit) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const url = subreddit
        ? `https://meme-api.com/gimme/${encodeURIComponent(subreddit)}`
        : 'https://meme-api.com/gimme';

        const { data } = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                         'Accept': 'application/json'
            }
        });

        if (!data || !data.url) continue;
        if (data.nsfw) continue;

        const urlLower = data.url.toLowerCase();
        const isImage = urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg') || urlLower.endsWith('.png') || urlLower.endsWith('.webp');
        if (!isImage) continue;

        return data;
    }
    throw new Error('No suitable image meme found');
}

module.exports = {
    name: 'meme',
    aliases: ['memes'],
    category: 'Fun',
    desc: 'Fetch a random image meme.\n.meme\n.meme <subreddit>',

    execute: async (sock, from, msg, args) => {
        const subreddit = args[0]?.trim() || null;

        try {
            const meme = await fetchMeme(subreddit);

            const imgRes = await axios.get(meme.url, {
                responseType: 'arraybuffer',
                timeout: 20000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            const buffer = Buffer.from(imgRes.data);

            if (buffer.length < 5120) {
                return sock.sendMessage(from, {
                    text: '❌ Meme file too small. Try again.'
                }, { quoted: msg });
            }

            const caption =
            `😂 *${meme.title || 'Meme'}*\n\n` +
            `📡 r/${meme.subreddit || 'memes'}\n` +
            `👤 u/${meme.author || 'unknown'}\n` +
            `⬆️ ${meme.ups || 0} upvotes`;

            await sock.sendMessage(from, {
                image: buffer,
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            console.error('[meme] error:', err.message);
            await sock.sendMessage(from, {
                text: '❌ Could not fetch a meme. Try again.'
            }, { quoted: msg });
        }
    }
};
