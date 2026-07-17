const axios = require('axios');

module.exports = {
    name: 'define',
    aliases: ['dict', 'dictionary', 'meaning'],
    category: 'Tools',
    desc: 'Get definition of a word.\n.define hello',

    execute: async (sock, from, msg, args) => {
        const word = args[0];
        if (!word) {
            return sock.sendMessage(from, {
                text: '❌ Please provide a word!\nUsage: `.define hello`'
            }, { quoted: msg });
        }

        try {
            const { data } = await axios.get(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
                                             { timeout: 10000 }
            );

            if (!data || !data[0]) {
                return sock.sendMessage(from, {
                    text: `❌ No definition found for *${word}*.`
                }, { quoted: msg });
            }

            const entry = data[0];
            const wordText = entry.word || word;
            const phonetic = entry.phonetic || '';

            let text = `📖 *${wordText.toUpperCase()}*`;
            if (phonetic) text += `\n🔊 _${phonetic}_\n`;

            const meanings = entry.meanings || [];
            let count = 0;

            for (const meaning of meanings) {
                if (count >= 3) break;
                const pos = meaning.partOfSpeech || '';
                const definitions = meaning.definitions || [];

                for (const def of definitions) {
                    if (count >= 3) break;
                    text += `\n\n*${pos}*\n📝 ${def.definition}`;
                    if (def.example) text += `\n💬 _${def.example}_`;
                    count++;
                }
            }

            if (count === 0) {
                text += `\n\n📝 No definitions available.`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });

        } catch (err) {
            if (err.response?.status === 404) {
                await sock.sendMessage(from, {
                    text: `❌ No definition found for *${word}*. Check the spelling.`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    text: '❌ Failed to fetch definition. Try again.'
                }, { quoted: msg });
            }
        }
    }
};
