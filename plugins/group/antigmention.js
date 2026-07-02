const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../../database/antifeatures.json');
const WARNINGS_PATH = path.join(__dirname, '../../database/warnings.json');
const VARS_PATH = path.join(__dirname, '../../database/vars.json');

function readJSON(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(fallback));
            return fallback;
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return fallback; }
}
function writeJSON(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getGroupSetting(groupJid, key) {
    const data = readJSON(SETTINGS_PATH);
    return data[groupJid]?.[key] || 'off';
}
function setGroupSetting(groupJid, key, value) {
    const data = readJSON(SETTINGS_PATH);
    if (!data[groupJid]) data[groupJid] = {};
    data[groupJid][key] = value;
    writeJSON(SETTINGS_PATH, data);
}

function isSudoOrOwner(jid) {
    try {
        const vars = readJSON(VARS_PATH, {});
        const owners = Array.isArray(vars.OWNERS) ? vars.OWNERS : (vars.OWNERS || '').split(',').map(s => s.trim()).filter(Boolean);
        const sudos = Array.isArray(vars.SUDOS) ? vars.SUDOS : (vars.SUDOS || '').split(',').map(s => s.trim()).filter(Boolean);
        const all = [...new Set([...owners, ...sudos])];
        const cleanJid = jid.split('@')[0].replace(/\D/g, '');
        return all.some(entry => {
            const cleanEntry = entry.split('@')[0].replace(/\D/g, '');
            return cleanJid === cleanEntry;
        });
    } catch {
        return false;
    }
}

function getWarnings(groupJid, userJid) {
    const data = readJSON(WARNINGS_PATH);
    if (!data[groupJid]) data[groupJid] = {};
    if (!data[groupJid][userJid]) data[groupJid][userJid] = 0;
    return data[groupJid][userJid];
}
function addWarning(groupJid, userJid) {
    const data = readJSON(WARNINGS_PATH);
    if (!data[groupJid]) data[groupJid] = {};
    if (!data[groupJid][userJid]) data[groupJid][userJid] = 0;
    data[groupJid][userJid] += 1;
    writeJSON(WARNINGS_PATH, data);
    return data[groupJid][userJid];
}
function resetWarnings(groupJid, userJid) {
    const data = readJSON(WARNINGS_PATH);
    if (data[groupJid] && data[groupJid][userJid]) {
        delete data[groupJid][userJid];
        writeJSON(WARNINGS_PATH, data);
    }
}

async function handleMention(sock, msg) {
    const from = msg.key.remoteJid;
    if (!from.endsWith('@g.us')) return;

    const setting = getGroupSetting(from, 'antigmention');
    if (setting === 'off') return;

    const senderJid = msg.key.participant || msg.key.participantAlt || '';
    if (!senderJid) return;

    let isAdmin = false;
    try {
        const meta = await sock.groupMetadata(from);
        isAdmin = meta.participants.some(p =>
        p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );
    } catch {}
    if (isAdmin || msg.key.fromMe || isSudoOrOwner(senderJid)) return;

    try {
        await sock.sendMessage(from, { delete: msg.key });
    } catch {}

    if (setting === 'kick') {
        try {
            await sock.groupParticipantsUpdate(from, [senderJid], 'remove');
            await sock.sendMessage(from, {
                text: `👢 Redskull has detected @${senderJid.split('@')[0]} mentioned the group on their status.\n_Kicked._`,
                                   mentions: [senderJid]
            });
        } catch {
            await sock.sendMessage(from, {
                text: `❌ Failed to kick @${senderJid.split('@')[0]}. Make sure I'm an admin.`,
                                   mentions: [senderJid]
            });
        }
        return;
    }

    if (setting === 'warn') {
        const currentWarnings = getWarnings(from, senderJid);
        if (currentWarnings >= 2) {
            try {
                await sock.groupParticipantsUpdate(from, [senderJid], 'remove');
                await sock.sendMessage(from, {
                    text: `👢 Redskull has detected @${senderJid.split('@')[0]} mentioned the group on their status.\n_Already warned twice — kicked._`,
                                       mentions: [senderJid]
                });
                resetWarnings(from, senderJid);
            } catch {
                await sock.sendMessage(from, {
                    text: `❌ Failed to kick @${senderJid.split('@')[0]} after 3 warnings.`,
                                       mentions: [senderJid]
                });
            }
        } else {
            const newCount = addWarning(from, senderJid);
            const left = 2 - newCount;
            await sock.sendMessage(from, {
                text: `⚠️ Redskull has detected @${senderJid.split('@')[0]} mentioned the group on their status.\n_Warning ${newCount}/2 — ${left} warning${left !== 1 ? 's' : ''} left before kick._`,
                                   mentions: [senderJid]
            });
        }
    }
}

module.exports = {
    name: 'antigmention',
    aliases: [],
    category: 'Group',
    desc: 'Punish users who mention this group in their WhatsApp status',
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
        const allowed = isGroupAdmin || perms?.isOwner || isSudoOrOwner(senderJid);
        if (!allowed)
            return sock.sendMessage(from, { text: '❌ Only *Group Admins*, *Sudo*, or *Owner* can change anti‑mention settings.' });

        const sub = args[0]?.toLowerCase();
        const action = args[1]?.toLowerCase();

        if (sub === 'on') {
            if (action !== 'warn' && action !== 'kick')
                return sock.sendMessage(from, { text: `Usage: \`${prefix}antigmention on <warn|kick>\`` });
            setGroupSetting(from, 'antigmention', action);
            await sock.sendMessage(from, { text: `✅ Anti‑mention is *ON* — ${action === 'warn' ? '3‑strike warning system' : 'immediate kick'}` });
        } else if (sub === 'off') {
            setGroupSetting(from, 'antigmention', 'off');
            await sock.sendMessage(from, { text: '✅ Anti‑mention is *OFF*' });
        } else {
            const cur = getGroupSetting(from, 'antigmention');
            await sock.sendMessage(from, {
                text: `📢 *Anti Group‑Mention*\nCurrent: *${cur === 'off' ? 'OFF' : 'ON (' + cur.toUpperCase() + ')'}*\n\n` +
                `Admins, Sudo & Owner are exempt.\n\n` +
                `Usage:\n\`${prefix}antigmention on warn\`\n\`${prefix}antigmention on kick\`\n\`${prefix}antigmention off\``
            });
        }
    }
};

(function attach() {
    if (!global.sock) return setTimeout(attach, 500);
    global.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            if (msg.message.groupStatusMentionMessage?.message?.protocolMessage?.type === 25) {
                try {
                    await handleMention(global.sock, msg);
                } catch (err) {
                    console.error('[antigmention] Handler error:', err.message);
                }
            }
        }
    });
    console.log('[antigmention] Listener active');
})();
