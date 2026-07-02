const google = require('googlethis');
const axios = require('axios');

// Strict check for Pinterest images
function isPinterestUrl(url) {
    return /pinimg\.com|pinterest\.com/i.test(url);
}

module.exports = {
    name: 'pinterest',
    aliases: ['pin', 'pint'],
    description: 'Search Pinterest images (accurate & high quality). .pint <query> (default 3), .pint <number> <query> (max 10)',
    category: 'Download',
    execute: async (sock, from, msg, args) => {
        let count = 3;
        let query;

        if (!isNaN(args[0])) {
            count = Math.min(parseInt(args[0]), 10);
            query = args.slice(1).join(' ');
        } else {
            query = args.join(' ');
        }

        if (!query) {
            return sock.sendMessage(from, {
                text: `📌 *Pinterest Image Search*\n\nUsage:\n.pint <query> → 3 images\n.pint 5 <query> → up to 10 images\nExample: .pint ironman pfp`
            });
        }

        // Force Google to return only Pinterest results
        const searchQuery = `${query} site:pinterest.com`;

        await sock.sendMessage(from, { text: `📌 Searching Pinterest for *${query}*…` });

        try {
            const options = {
                page: 0,
                safe: false,
                additional_params: { hl: 'en' },
            };
            const response = await google.image(searchQuery, options);

            if (!response || response.length === 0) {
                return sock.sendMessage(from, { text: '❌ No images found.' });
            }

            // Use original (high-res) URLs and filter strictly for Pinterest
            const imageUrls = response
            .map(item => item.origin)          // original full‑size image
            .filter(url => isPinterestUrl(url))
            .slice(0, count);

            if (imageUrls.length === 0) {
                return sock.sendMessage(from, { text: '❌ No Pinterest images found for that query.' });
            }

            // Download and send each image
            let sent = 0;
            for (const imageUrl of imageUrls) {
                if (sent >= count) break;
                try {
                    const res = await axios.get(imageUrl, {
                        responseType: 'arraybuffer',
                        timeout: 20000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    await sock.sendMessage(from, { image: Buffer.from(res.data) });
                    sent++;
                    if (sent < count) await new Promise(r => setTimeout(r, 1000));
                } catch (imgErr) {
                    console.log(`[pin] Failed to download: ${imageUrl}`);
                }
            }

            if (sent === 0) {
                await sock.sendMessage(from, { text: '❌ Could not download any images.' });
            }
        } catch (err) {
            console.error('[pin] Search error:', err.message);
            await sock.sendMessage(from, { text: '❌ *Search failed.* Google might be blocking automated requests. Try again later.' });
        }
    }
};
