const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '../../database/messageCache.json');

function loadCache() {
    try {
        if (!fs.existsSync(CACHE_PATH)) return {};
        return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch { return {}; }
}

function saveCache(data) {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data));
}

if (!global.messageCache) {
    global.messageCache = new Map();
    const saved = loadCache();
    for (const [jid, msgs] of Object.entries(saved)) {
        global.messageCache.set(jid, msgs);
    }
}

function persistCache() {
    const obj = {};
    for (const [jid, msgs] of global.messageCache) {
        obj[jid] = msgs.slice(-500);
    }
    saveCache(obj);
}

(function attachCache() {
    if (!global.sock) return setTimeout(attachCache, 500);
    global.sock.ev.on('messages.upsert', ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const jid = msg.key.remoteJid;
            if (!jid || !jid.includes('@g.us')) continue;

            if (!global.messageCache.has(jid)) global.messageCache.set(jid, []);
            const arr = global.messageCache.get(jid);

            arr.push({
                key: msg.key,
                participant: msg.key.participant || msg.key.remoteJid
            });

            if (arr.length > 500) arr.shift();
        }
        persistCache();
    });
    console.log('[purge] Message cache listener active');
})();

module.exports = {
    name: 'purge',
    aliases: [],
    category: 'Group',
    desc: 'Delete messages of a user. .purge <amount/all> @user or reply + .purge <amount/all>',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This command only works in groups.' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);

        const meta = await sock.groupMetadata(from);
        const isGroupAdmin = meta.participants.some(p =>
        p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        const allowed = isGroupAdmin || perms?.isOwner;
        if (!allowed)
            return sock.sendMessage(from, { text: '❌ Only *Group Admins* or *Owner* can purge messages.' });

        let targetJid = null;
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;

        if (contextInfo?.mentionedJid?.length) {
            targetJid = contextInfo.mentionedJid[0];
        } else if (contextInfo?.participant) {
            targetJid = contextInfo.participant;
        }

        if (!targetJid)
            return sock.sendMessage(from, { text: `❌ Mention a user or reply to their message.\nUsage: \`${prefix}purge 50 @user\` or reply + \`${prefix}purge all\`` });

        let amount = 10;
        if (!args[0] || args[0].toLowerCase() === 'all') {
            amount = 500;
        } else if (!isNaN(parseInt(args[0]))) {
            amount = Math.min(parseInt(args[0]), 500);
            if (amount < 1) amount = 10;
        }

        const cache = global.messageCache.get(from);
        if (!cache || cache.length === 0) {
            return sock.sendMessage(from, { text: `❌ No messages in cache. Cache size: ${cache ? cache.length : 0}` });
        }

        const targetMsgs = cache.filter(m => {
            const p = m.participant;
            if (!p) return false;
            return p === targetJid;
        });

        if (targetMsgs.length === 0) {
            const availJids = [...new Set(cache.map(m => m.participant))].slice(0, 5);
            return sock.sendMessage(from, {
                text: `❌ No messages from that user in cache.\nTarget: ${targetJid}\nAvailable in cache: ${availJids.join(', ')}`
            });
        }

        const toDelete = targetMsgs.slice(-amount);
        let deleted = 0;

        for (const m of toDelete) {
            try {
                await sock.sendMessage(from, { delete: m.key });
                const idx = cache.findIndex(c => c.key.id === m.key.id);
                if (idx !== -1) cache.splice(idx, 1);
                deleted++;
            } catch {}
        }

        persistCache();

        const targetNum = targetJid.split('@')[0];
        await sock.sendMessage(from, {
            text: `✅ Purged *${deleted}* message(s) from @${targetNum}.`,
                               mentions: [targetJid]
        });
    }
};
