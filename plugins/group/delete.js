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
                participant: msg.key.participant || msg.key.remoteJid,
                participantAlt: msg.key.participantAlt || msg.key.participantPn || null,
                fromMe: msg.key.fromMe || false,
                senderJid: msg.key.participant || msg.key.remoteJid
            });

            if (arr.length > 500) arr.shift();
        }
        persistCache();
    });
    console.log('[purge] Message cache listener active');
})();

module.exports = {
    name: 'purge',
    aliases: ['del', 'dlt', 'delete'],
    category: 'Group',
    desc: 'Delete messages of a user.\n.purge <amount/all> @user\nReply + .del <amount>',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This command only works in groups.' }, { quoted: msg });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);
        const commandName = rawText.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();

        const meta = await sock.groupMetadata(from);
        const isGroupAdmin = meta.participants.some(p =>
        p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        const allowed = isGroupAdmin || perms?.isOwner || perms?.isSudo;

        if (!allowed)
            return sock.sendMessage(from, { text: '❌ Only *Group Admins*, *Sudo*, or *Owner* can use this.' }, { quoted: msg });

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedContext = contextInfo;
        const hasQuote = !!quotedContext?.stanzaId;

        let targetJid = null;
        let amount = 1;
        let isSingleDelete = false;

        const parsedAmount = parseInt(args[0]);
        const argIsNumber = !isNaN(parsedAmount) && parsedAmount > 0;

        if (contextInfo?.mentionedJid?.length) {
            targetJid = contextInfo.mentionedJid[0];
            if (argIsNumber) amount = Math.min(parsedAmount, 500);
            else if (args[0]?.toLowerCase() === 'all') amount = 500;
            else amount = 10;
        } else if (hasQuote) {
            targetJid = quotedContext.participant || quotedContext.remoteJid;
            if (argIsNumber) amount = Math.min(parsedAmount, 500);
            else if (args[0]?.toLowerCase() === 'all') amount = 500;
            else amount = 1;
        } else {
            return sock.sendMessage(from, {
                text: `❌ Mention a user or reply to their message.\nUsage:\n\`${prefix}${commandName} 40 @user\`\nReply + \`${prefix}${commandName} 40\``
            }, { quoted: msg });
        }

        if (amount === 1 && hasQuote) isSingleDelete = true;

        if (isSingleDelete) {
            const targetMessageKey = {
                remoteJid: from,
                fromMe: (quotedContext.participant || quotedContext.remoteJid) === botJid,
                id: quotedContext.stanzaId,
                participant: quotedContext.participant || quotedContext.remoteJid
            };

            let success = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await sock.sendMessage(from, { delete: targetMessageKey });
                    success = true;
                    break;
                } catch (err) {
                    if (attempt < 3) await new Promise(r => setTimeout(r, 400));
                }
            }

            try {
                await sock.sendMessage(from, { delete: msg.key });
            } catch {}

            if (!success) {
                await sock.sendMessage(from, {
                    text: '❌ Could not delete. Message may be too old.'
                });
            }
            return;
        }

        const cache = global.messageCache.get(from);
        if (!cache || cache.length === 0) {
            return sock.sendMessage(from, { text: '❌ No messages in cache yet.' }, { quoted: msg });
        }

        const targetMsgs = cache.filter(m => {
            const p = m.participant;
            const pa = m.participantAlt;
            return p === targetJid || pa === targetJid || m.senderJid === targetJid;
        });

        if (targetMsgs.length === 0) {
            return sock.sendMessage(from, {
                text: `❌ No messages from that user found in cache.`
            }, { quoted: msg });
        }

        const toDelete = targetMsgs.slice(-amount);
        let deleted = 0;

        for (const m of toDelete) {
            const key = {
                remoteJid: m.key.remoteJid,
                fromMe: m.key.fromMe || false,
                id: m.key.id,
                participant: m.key.participant
            };
            try {
                await sock.sendMessage(from, { delete: key });
                const idx = cache.findIndex(c => c.key.id === m.key.id);
                if (idx !== -1) cache.splice(idx, 1);
                deleted++;
            } catch {}
        }

        persistCache();

        try {
            await sock.sendMessage(from, { delete: msg.key });
        } catch {}

        if (deleted === 0) {
            await sock.sendMessage(from, { text: '❌ Could not delete any messages. They may be too old.' });
        }
    }
};
