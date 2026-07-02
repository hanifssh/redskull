const axios = require('axios');

module.exports = {
    name: 'imagine',
    aliases: ['generate'],
    category: 'AI',
    desc: 'Generate an AI image from a text prompt (free, no key)',
    execute: async (sock, from, msg, args, perms) => {
        if (!args[0]) {
            return sock.sendMessage(from, {
                text: '❌ Please provide a prompt.\nUsage: `.imagine a cat wearing sunglasses`'
            });
        }

        const prompt = args.join(' ');
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;

        await sock.sendMessage(from, {
            image: { url: imageUrl },
            caption: `🖼️ *${prompt}*`
        });
    }
};
