const axios = require('axios');

const WordGuess = {};
const GAME_TIMEOUT = 2 * 60 * 1000;

module.exports = {
    name: 'wordguess',
    aliases: ['wg', 'guess'],
    category: 'Games',
    desc: 'Guess the word game.\n.wordguess → start a round\nAnyone can reply with the answer!',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This game only works in groups!' }, { quoted: msg });

        const gameKey = `${from}_wg`;
        if (WordGuess[gameKey]) {
            return sock.sendMessage(from, { text: '❌ A round is already active! Wait for it to end.' }, { quoted: msg });
        }

        try {
            const { data } = await axios.get('https://www.wordgamedb.com/api/v2/words/random', { timeout: 10000 });
            const wordData = data?.words || data;
            const word = (Array.isArray(wordData) ? wordData[0] : wordData)?.word?.toLowerCase() || 'elephant';
            const hint = (Array.isArray(wordData) ? wordData[0] : wordData)?.hint || 'No hint available';
            const category = (Array.isArray(wordData) ? wordData[0] : wordData)?.category || 'general';
            const letters = (Array.isArray(wordData) ? wordData[0] : wordData)?.letters || word.length;

            WordGuess[gameKey] = {
                word,
                hint,
                category,
                letters,
                timeout: null
            };

            WordGuess[gameKey].timeout = setTimeout(() => {
                if (WordGuess[gameKey]) {
                    global.sock.sendMessage(from, {
                        text: `⏰ *TIME'S UP!*\n\nThe word was *${word.toUpperCase()}*\n\n😢 No one guessed it!`
                    });
                    delete WordGuess[gameKey];
                }
            }, GAME_TIMEOUT);

            await sock.sendMessage(from, {
                text: `❓ *WORD GUESS*\n\nCategory: *${category}*\nHint: _${hint}_\nLetters: *${letters}*\n\n⏳ Reply with your guess! You have *2 minutes*!`
            }, { quoted: msg });

        } catch (err) {
            console.error('[wordguess] Error:', err.message);
            await sock.sendMessage(from, { text: '❌ Failed to fetch word. Try again.' }, { quoted: msg });
        }
    }
};

(function wordGuessListener() {
    if (!global.sock) return setTimeout(wordGuessListener, 500);
    global.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const from = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim().toLowerCase();
            const isReply = !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (!text) continue;

            const gameKey = `${from}_wg`;
            const game = WordGuess[gameKey];
            if (!game) continue;

            if (!isReply) continue;

            if (text === game.word.toLowerCase()) {
                clearTimeout(game.timeout);
                await global.sock.sendMessage(from, {
                    text: `🎉 *CORRECT!*\n\n@${sender.split('@')[0]} guessed the word *${game.word.toUpperCase()}*!\n\n🏆 Winner! 🏆`,
                                              mentions: [sender]
                }, { quoted: msg });
                delete WordGuess[gameKey];
            }
        }
    });
})();
