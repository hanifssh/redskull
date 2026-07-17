const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');

module.exports = {
    name: 'salute',
    aliases: [],
    category: 'Reactions',
    desc: 'Salute someone! .salute @user or reply with .salute',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Reactions only work in groups!' }, { quoted: msg });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;

        let mentioned = contextInfo?.mentionedJid?.[0];
        if (!mentioned && contextInfo?.participant) {
            mentioned = contextInfo.participant;
        }

        if (!mentioned) {
            return sock.sendMessage(from, { text: '❌ Mention or reply to someone!\n.salute @user' }, { quoted: msg });
        }

        let tmpGif = '', tmpMp4 = '';
        try {
            const { data } = await axios.get('https://nekos.best/api/v2/salute', {
                headers: { 'User-Agent': 'RedSkullBot (https://github.com/hanifssh/redskull)' },
                                             timeout: 15000
            });

            const gifUrl = data.results[0].url;
            const gif = await axios.get(gifUrl, {
                responseType: 'arraybuffer',
                timeout: 20000,
                maxRedirects: 5,
                headers: { 'User-Agent': 'RedSkullBot (https://github.com/hanifssh/redskull)' }
            });

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

            const id = Date.now();
            tmpGif = path.join(TEMP_DIR, `salute_${id}.gif`);
            tmpMp4 = path.join(TEMP_DIR, `salute_${id}.mp4`);
            fs.writeFileSync(tmpGif, Buffer.from(gif.data));

            execSync(`ffmpeg -y -i "${tmpGif}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${tmpMp4}"`, { stdio: 'ignore' });

            await sock.sendMessage(from, {
                video: fs.readFileSync(tmpMp4),
                                   gifPlayback: true,
                                   caption: `@${senderJid.split('@')[0]} saluted @${mentioned.split('@')[0]}`,
                                   mentions: [senderJid, mentioned]
            }, { quoted: msg });

        } catch (err) {
            console.error('[salute] Error:', err.message);
            await sock.sendMessage(from, { text: '❌ Could not fetch reaction. Try again.' }, { quoted: msg });
        } finally {
            setTimeout(() => {
                try { if (tmpGif) fs.unlinkSync(tmpGif); } catch {}
                try { if (tmpMp4) fs.unlinkSync(tmpMp4); } catch {}
            }, 60000);
        }
    }
};
