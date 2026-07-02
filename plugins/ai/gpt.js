const axios = require('axios');

const SYSTEM_PROMPT = `You are a helpful, friendly AI assistant. Keep replies short and clear.`;

async function askAI(userMessage) {
    try {
        const prompt = encodeURIComponent(SYSTEM_PROMPT + "\nUser: " + userMessage + "\nAssistant:");
        const url = `https://text.pollinations.ai/${prompt}`;
        const res = await axios.get(url, { timeout: 25000 });
        return res.data.trim();
    } catch (err) {
        console.error('[gpt] Pollinations error:', err.message);
        return null;
    }
}

module.exports = {
    name: 'gpt',
    aliases: [],
    category: 'AI',
    desc: 'Ask the AI any question (.gpt <query>)',

    execute: async (sock, from, msg, args) => {
        if (!args[0]) {
            return sock.sendMessage(from, { text: '❌ Please provide a question.\nUsage: `.gpt what is the capital of France?`' });
        }

        const question = args.join(' ');
        await sock.sendPresenceUpdate('composing', from);

        const reply = await askAI(question);
        const finalReply = reply || "Sorry, I couldn't fetch a response right now.";

        await sock.sendMessage(from, { text: finalReply }, { quoted: msg });
    }
};
