const axios = require('axios');

const BASE = 'https://api.truthordarebot.xyz/v1';

module.exports = {
    name: 'truthdare',
    aliases: ['tnd', 'truth', 'dare', 'wyr', 'nhie', 'paranoia'],
    category: 'Games',
    desc: 'Play Truth or Dare with someone.\n.truth @user\n.dare @user\n.wyr @user\n.nhie @user\n.paranoia @user',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This game only works in groups!' }, { quoted: msg });

        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);
        const command = rawText.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();

        const endpoints = {
            truth: 'truth',
            dare: 'dare',
            wyr: 'wyr',
            nhie: 'nhie',
            paranoia: 'paranoia'
        };

        const type = endpoints[command];
        if (!type) {
            return sock.sendMessage(from, {
                text: `🎯 *Truth or Dare*\n\nAsk someone:\n• \`${prefix}truth @user\`\n• \`${prefix}dare @user\`\n• \`${prefix}wyr @user\`\n• \`${prefix}nhie @user\`\n• \`${prefix}paranoia @user\`\n\nOr play solo:\n• \`${prefix}truth me\``
            }, { quoted: msg });
        }

        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const senderJid = msg.key.participant || msg.key.remoteJid;

        let target = null;
        if (mentioned && mentioned !== senderJid) {
            target = mentioned;
        } else if (args[0]?.toLowerCase() === 'me') {
            target = senderJid;
        } else {
            return sock.sendMessage(from, {
                text: `❌ Mention someone or use \`${prefix}${command} me\`\nExample: \`${prefix}${command} @user\``
            }, { quoted: msg });
        }

        let rating = args[0]?.toLowerCase();
        if (['me', 'pg', 'pg13', 'r'].includes(rating) && rating !== 'me') {
        } else if (target === senderJid) {
            rating = args[1]?.toLowerCase();
        }
        if (!['pg', 'pg13', 'r'].includes(rating)) rating = 'pg13';

        try {
            const { data } = await axios.get(`${BASE}/${type}`, {
                params: { rating },
                timeout: 10000
            });

            const emoji = {
                TRUTH: '🤔',
                DARE: '🔥',
                WYR: '⚖️',
                NHIE: '🍸',
                PARANOIA: '👀'
            };

            const title = {
                TRUTH: 'TRUTH',
                DARE: 'DARE',
                WYR: 'WOULD YOU RATHER',
                NHIE: 'NEVER HAVE I EVER',
                PARANOIA: 'PARANOIA'
            };

            const isSelf = target === senderJid;
            const asker = isSelf ? 'You asked yourself' : `@${senderJid.split('@')[0]} asked`;

            await sock.sendMessage(from, {
                text: `${emoji[data.type]} *${title[data.type]}*\n${asker}  →  @${target.split('@')[0]}\n_Rating: ${data.rating}_\n\n${data.question}`,
                                   mentions: [senderJid, target]
            }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(from, {
                text: '❌ Could not fetch question. Try again.'
            }, { quoted: msg });
        }
    }
};
