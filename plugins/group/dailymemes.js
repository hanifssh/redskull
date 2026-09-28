const axios = require('axios');
const fs = require('fs');
const path = require('path');

const VARS_PATH = path.join(__dirname, '../../database/vars.json');
const MEME_INTERVALS = new Map();

const DEFAULT_INTERVAL = 60;
const DEFAULT_SUBS = ['memes', 'dankmemes', 'me_irl', 'meirl', 'wholesomememes'];

function readVars() {
    try { return JSON.parse(fs.readFileSync(VARS_PATH, 'utf8')); } catch { return {}; }
}
function writeVars(obj) {
    fs.mkdirSync(path.dirname(VARS_PATH), { recursive: true });
    fs.writeFileSync(VARS_PATH, JSON.stringify(obj, null, 2));
}

async function fetchMeme(subreddits) {
    const subs = subreddits && subreddits.length ? subreddits : DEFAULT_SUBS;

    for (let attempt = 0; attempt < 8; attempt++) {
        const sub = subs[Math.floor(Math.random() * subs.length)];
        const url = `https://meme-api.com/gimme/${encodeURIComponent(sub)}`;

        try {
            const { data } = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                             'Accept': 'application/json'
                }
            });

            if (!data || !data.url) continue;
            if (data.nsfw) continue;

            const u = data.url.toLowerCase();
            const isImage = u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.png') || u.endsWith('.webp');
            if (!isImage) continue;

            return data;
        } catch (err) {
            console.error('[dailymeme] fetch attempt failed:', err.message);
        }
    }
    return null;
}

async function postMeme(sock, groupJid, subreddits) {
    try {
        const meme = await fetchMeme(subreddits);
        if (!meme) {
            console.log('[dailymeme] no valid meme found');
            return;
        }

        const imgRes = await axios.get(meme.url, {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const buffer = Buffer.from(imgRes.data);
        if (buffer.length < 5120) return;

        let meta;
        try {
            meta = await sock.groupMetadata(groupJid);
        } catch {
            return;
        }

        const mentions = meta.participants.map(p => p.id);

        const caption =
        `😂 *${meme.title || 'Meme'}*\n\n` +
        `📡 r/${meme.subreddit || 'memes'}\n` +
        `⬆️ ${meme.ups || 0} upvotes`;

        await sock.sendMessage(groupJid, {
            image: buffer,
            caption: caption,
            mentions: mentions
        });

        console.log(`[dailymeme] sent to ${groupJid}`);
    } catch (err) {
        console.error('[dailymeme] post error:', err.message);
    }
}

function startMemeInterval(sock, groupJid, mins, subreddits) {
    if (MEME_INTERVALS.has(groupJid)) {
        clearInterval(MEME_INTERVALS.get(groupJid));
        MEME_INTERVALS.delete(groupJid);
    }

    console.log(`[dailymeme] starting for ${groupJid} every ${mins} min`);

    postMeme(sock, groupJid, subreddits);

    const interval = setInterval(() => {
        console.log(`[dailymeme] tick for ${groupJid}`);
        postMeme(sock, groupJid, subreddits);
    }, mins * 60 * 1000);

    MEME_INTERVALS.set(groupJid, interval);
}

module.exports = {
    name: 'dailymeme',
    aliases: ['dailymemes'],
    category: 'Group',
    desc: 'Auto-post memes every X minutes.\n.dailymeme on\n.dailymeme interval <minutes>\n.dailymeme sub <subreddit,subreddit>\n.dailymeme off',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Only works in groups!' }, { quoted: msg });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        let allowed = perms?.isOwner || perms?.isSudo;

        if (!allowed) {
            try {
                const meta = await sock.groupMetadata(from);
                allowed = meta.participants.some(p =>
                p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
                );
            } catch {}
        }

        if (!allowed) {
            return sock.sendMessage(from, { text: '❌ Owner, sudo, or group admin only.' }, { quoted: msg });
        }

        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);
        const command = rawText.slice(prefix.length).trim().split(/\s+/);
        const sub = command[1]?.toLowerCase();

        const vars = readVars();
        vars.DAILYMEME = vars.DAILYMEME || {};

        if (sub === 'off') {
            const interval = MEME_INTERVALS.get(from);
            if (interval) clearInterval(interval);
            MEME_INTERVALS.delete(from);

            if (vars.DAILYMEME[from]) {
                delete vars.DAILYMEME[from];
                writeVars(vars);
            }

            return sock.sendMessage(from, { text: '😂 Daily memes turned off.' }, { quoted: msg });
        }

        if (sub === 'interval') {
            const mins = parseInt(command[2]);
            if (isNaN(mins) || mins < 5 || mins > 1440)
                return sock.sendMessage(from, { text: '❌ Interval must be 5-1440 minutes.' }, { quoted: msg });

            vars.DAILYMEME[from] = vars.DAILYMEME[from] || { active: false, subs: null };
            vars.DAILYMEME[from].interval = mins;
            writeVars(vars);

            if (MEME_INTERVALS.has(from)) {
                startMemeInterval(sock, from, mins, vars.DAILYMEME[from].subs);
            }

            return sock.sendMessage(from, { text: `😂 Meme interval set to *${mins} min*.` }, { quoted: msg });
        }

        if (sub === 'sub' || sub === 'subs') {
            const subsArg = command.slice(2).join(' ').trim();
            if (!subsArg)
                return sock.sendMessage(from, { text: `Usage: \`${prefix}dailymeme sub dankmemes,memes\`` }, { quoted: msg });

            const subsList = subsArg.split(',').map(s => s.trim()).filter(Boolean);
            if (!subsList.length)
                return sock.sendMessage(from, { text: '❌ Provide at least one subreddit.' }, { quoted: msg });

            vars.DAILYMEME[from] = vars.DAILYMEME[from] || { interval: DEFAULT_INTERVAL, active: false };
            vars.DAILYMEME[from].subs = subsList;
            writeVars(vars);

            if (MEME_INTERVALS.has(from)) {
                startMemeInterval(sock, from, vars.DAILYMEME[from].interval, subsList);
            }

            return sock.sendMessage(from, { text: `😂 Subreddits set to: *${subsList.join(', ')}*` }, { quoted: msg });
        }

        if (sub === 'on') {
            vars.DAILYMEME[from] = vars.DAILYMEME[from] || {};
            const mins = vars.DAILYMEME[from].interval || DEFAULT_INTERVAL;
            const subs = vars.DAILYMEME[from].subs || null;

            vars.DAILYMEME[from].active = true;
            vars.DAILYMEME[from].interval = mins;
            vars.DAILYMEME[from].subs = subs;
            writeVars(vars);

            startMemeInterval(sock, from, mins, subs);

            const subsText = subs ? subs.join(', ') : 'default (memes, dankmemes, me_irl...)';
            return sock.sendMessage(from, {
                text: `😂 *DAILY MEMES ON*\n\nEvery *${mins} min*\nSubreddits: *${subsText}*`
            }, { quoted: msg });
        }

        return sock.sendMessage(from, {
            text:
            `😂 *DAILY MEMES*\n\n` +
            `\`${prefix}dailymeme on\` — Start\n` +
            `\`${prefix}dailymeme off\` — Stop\n` +
            `\`${prefix}dailymeme interval <minutes>\` — Change interval\n` +
            `\`${prefix}dailymeme sub <subreddit,subreddit>\` — Custom subs\n\n` +
            `_Defaults: every 60 min, mixed subreddits_`
        }, { quoted: msg });
    }
};

(function restoreMemeIntervals() {
    if (!global.sock) return setTimeout(restoreMemeIntervals, 500);

    const vars = readVars();
    const saved = vars.DAILYMEME || {};

    console.log(`[dailymeme] restore check: ${Object.keys(saved).length} groups`);

    for (const [groupJid, data] of Object.entries(saved)) {
        if (!data.active) continue;

        const mins = data.interval || DEFAULT_INTERVAL;
        const subs = data.subs || null;

        startMemeInterval(global.sock, groupJid, mins, subs);
        console.log(`[dailymeme] restored for ${groupJid} (${mins} min)`);
    }
})();
