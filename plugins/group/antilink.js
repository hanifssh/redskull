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

function getGroupData(groupJid) {
    const data = readJSON(SETTINGS_PATH);
    if (!data[groupJid]) data[groupJid] = {};
    return data[groupJid];
}
function saveGroupData(groupJid, groupData) {
    const data = readJSON(SETTINGS_PATH);
    data[groupJid] = groupData;
    writeJSON(SETTINGS_PATH, data);
}

function getAntilinkMode(groupJid) {
    return getGroupData(groupJid).antilink || 'off';
}
function setAntilinkMode(groupJid, mode) {
    const gd = getGroupData(groupJid);
    gd.antilink = mode;
    saveGroupData(groupJid, gd);
}
function getAllowedDomains(groupJid) {
    return getGroupData(groupJid).antilink_allowed || [];
}
function addAllowedDomain(groupJid, domain) {
    const gd = getGroupData(groupJid);
    if (!gd.antilink_allowed) gd.antilink_allowed = [];
    if (!gd.antilink_allowed.includes(domain)) {
        gd.antilink_allowed.push(domain);
        saveGroupData(groupJid, gd);
    }
}
function removeAllowedDomain(groupJid, domain) {
    const gd = getGroupData(groupJid);
    if (gd.antilink_allowed) {
        gd.antilink_allowed = gd.antilink_allowed.filter(d => d !== domain);
        saveGroupData(groupJid, gd);
    }
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

function extractHostname(url) {
    try {
        const match = url.match(/https?:\/\/([^\/\s?#]+)/i);
        return match ? match[1].toLowerCase().replace(/^www\./, '') : null;
    } catch { return null; }
}

function isLinkAllowed(url, allowedDomains) {
    const hostname = extractHostname(url);
    if (!hostname) return false;
    return allowedDomains.some(domain => hostname.includes(domain.toLowerCase()));
}

function containsLink(text) {
    return /https?:\/\/\S+/i.test(text);
}

function extractUrls(text) {
    return text.match(/https?:\/\/\S+/gi) || [];
}

async function handleLink(sock, msg) {
    const from = msg.key.remoteJid;
    if (!from.endsWith('@g.us')) return;

    const mode = getAntilinkMode(from);
    if (mode === 'off') return;

    const text = msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    '';
    if (!text || !containsLink(text)) return;

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

    const allowedDomains = getAllowedDomains(from);
    const urls = extractUrls(text);
    const allAllowed = urls.length > 0 && urls.every(url => isLinkAllowed(url, allowedDomains));
    if (allAllowed) return;

    try {
        await sock.sendMessage(from, { delete: msg.key });
    } catch {}

    if (mode === 'kick') {
        try {
            await sock.groupParticipantsUpdate(from, [senderJid], 'remove');
            await sock.sendMessage(from, {
                text: `👢 Redskull has detected a link from @${senderJid.split('@')[0]}.\n_Kicked._`,
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

    if (mode === 'warn') {
        const currentWarnings = getWarnings(from, senderJid);
        if (currentWarnings >= 2) {
            try {
                await sock.groupParticipantsUpdate(from, [senderJid], 'remove');
                await sock.sendMessage(from, {
                    text: `👢 Redskull has detected a link from @${senderJid.split('@')[0]}.\n_Already warned twice — kicked._`,
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
                text: `⚠️ Redskull has detected a link from @${senderJid.split('@')[0]}.\n_Warning ${newCount}/2 — ${left} warning${left !== 1 ? 's' : ''} left before kick._`,
                                   mentions: [senderJid]
            });
        }
    }
}

module.exports = {
    name: 'antilink',
    aliases: [],
    category: 'Group',
    desc: 'Delete links from non‑admins and warn/kick the sender (with allowlist)',
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
            return sock.sendMessage(from, { text: '❌ Only *Group Admins*, *Sudo*, or *Owner* can change anti‑link settings.' });

        const sub = args[0]?.toLowerCase();
        const target = args[1]?.toLowerCase();

        if (sub === 'on') {
            if (target !== 'warn' && target !== 'kick')
                return sock.sendMessage(from, { text: `Usage: \`${prefix}antilink on <warn|kick>\`` });
            setAntilinkMode(from, target);
            await sock.sendMessage(from, { text: `✅ Anti‑link is *ON* — ${target === 'warn' ? '3‑strike warning system' : 'immediate kick'}` });
        } else if (sub === 'off') {
            setAntilinkMode(from, 'off');
            await sock.sendMessage(from, { text: '✅ Anti‑link is *OFF*' });
        } else if (sub === 'allow') {
            if (!target) return sock.sendMessage(from, { text: `Usage: \`${prefix}antilink allow <domain>\` (e.g., youtube.com)` });
            addAllowedDomain(from, target);
            await sock.sendMessage(from, { text: `✅ Allowed domain *${target}* added.` });
        } else if (sub === 'disallow') {
            if (!target) return sock.sendMessage(from, { text: `Usage: \`${prefix}antilink disallow <domain>\`` });
            removeAllowedDomain(from, target);
            await sock.sendMessage(from, { text: `✅ Allowed domain *${target}* removed.` });
        } else if (sub === 'allowed' || sub === 'allowlist') {
            const list = getAllowedDomains(from);
            if (list.length === 0) return sock.sendMessage(from, { text: '📋 No allowed domains set.' });
            await sock.sendMessage(from, { text: `📋 *Allowed Domains:*\n` + list.join('\n') });
        } else {
            const cur = getAntilinkMode(from);
            await sock.sendMessage(from, {
                text: `📢 *Anti‑Link*\nCurrent: *${cur === 'off' ? 'OFF' : 'ON (' + cur.toUpperCase() + ')'}*\n\n` +
                `Admins, Sudo & Owner are exempt.\n\n` +
                `Usage:\n\`${prefix}antilink on warn\`\n\`${prefix}antilink on kick\`\n\`${prefix}antilink off\`\n` +
                `\`${prefix}antilink allow <domain>\`\n\`${prefix}antilink disallow <domain>\`\n\`${prefix}antilink allowed\``
            });
        }
    }
};

(function attach() {
    if (!global.sock) return setTimeout(attach, 500);
    global.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            try {
                await handleLink(global.sock, msg);
            } catch (err) {
                console.error('[antilink] Handler error:', err.message);
            }
        }
    });
    console.log('[antilink] Listener active');
})();
