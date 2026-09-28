const { translate } = require('free-google-translate-geanpn');
const axios = require('axios');

function neutralize(text) {
    return '\u200B' + text;
}

async function tryGoogleLib(text, lang) {
    const result = await translate(text, { to: lang });
    if (result.success && result.text && result.text.trim()) {
        return result.text;
    }
    throw new Error(result.error || 'Empty');
}

async function tryMyMemory(text, lang) {
    const { data } = await axios.get('https://api.mymemory.translated.net/get', {
        params: { q: text, langpair: `auto|${lang}` },
        timeout: 15000
    });
    const t = data?.responseData?.translatedText;
    if (t && t.toLowerCase() !== text.toLowerCase()) return t;
    throw new Error('MyMemory empty');
}

module.exports = {
    name: 'translate',
    aliases: ['trt', 'tr'],
    category: 'Tools',
    desc: 'Translate text.\n.trt <lang> <text>\n.trt <lang> (reply)\n.trt list',

    execute: async (sock, from, msg, args, perms) => {
        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);
        const command = rawText.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const rest = rawText.slice(prefix.length + command.length).trim();

        if (!rest || rest === 'list') {
            return sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ ✠ ≫─━─━─━╮\n` +
                `│    *TRANSLATE*\n` +
                `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
                `│\n` +
                `│ ✗ .trt <lang> <text>\n` +
                `│ ✗ .trt ur Hello\n` +
                `│ ✗ .trt en (reply)\n` +
                `│\n` +
                `│ *Codes:* en, ur, hi, ar, es, fr,\n` +
                `│ de, ja, ko, zh, ru, pt, it, tr,\n` +
                `│ id, bn, fa, th, vi, nl\n` +
                `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`
            }, { quoted: msg });
        }

        const parts = rest.split(/\s+/);
        const targetLang = parts[0].toLowerCase();

        if (!/^[a-z]{2}(-[a-z]{2,4})?$/i.test(targetLang)) {
            return sock.sendMessage(from, {
                text: '❌ Invalid language code.'
            }, { quoted: msg });
        }

        let textToTranslate = parts.slice(1).join(' ').trim();

        if (!textToTranslate) {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const quotedMsg = contextInfo?.quotedMessage;
            if (quotedMsg) {
                textToTranslate =
                quotedMsg.conversation ||
                quotedMsg.extendedTextMessage?.text ||
                quotedMsg.imageMessage?.caption ||
                quotedMsg.videoMessage?.caption ||
                '';
            }
        }

        if (!textToTranslate) {
            return sock.sendMessage(from, {
                text: '❌ No text to translate.'
            }, { quoted: msg });
        }

        textToTranslate = textToTranslate.trim().slice(0, 1000);

        let translatedText = null;
        const errors = [];

        const apis = [
            { name: 'Google', fn: tryGoogleLib },
            { name: 'MyMemory', fn: tryMyMemory }
        ];

        for (const api of apis) {
            try {
                translatedText = await api.fn(textToTranslate, targetLang);
                if (translatedText && translatedText.trim().length > 1) {
                    console.log(`[translate] used ${api.name}`);
                    break;
                }
                translatedText = null;
            } catch (err) {
                errors.push(`${api.name}: ${err.message}`);
            }
        }

        if (!translatedText) {
            console.error('[translate] all failed:', errors.join(' | '));
            return sock.sendMessage(from, {
                text: '❌ Translation failed. Try again in a minute.'
            }, { quoted: msg });
        }

        const safeOutput = neutralize(translatedText);

        await sock.sendMessage(from, {
            text:
            `╭━─━─━─≪ ✠ ≫─━─━─━╮\n` +
            `│    *TRANSLATED*\n` +
            `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
            `\n` +
            `\n` +
            ` ${safeOutput}\n`
        }, { quoted: msg });
    }
};
