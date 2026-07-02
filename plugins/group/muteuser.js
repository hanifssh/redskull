const fs = require('fs');
const path = require('path');

const MUTE_PATH = path.join(__dirname, '../../database/mutes.json');
const VARS_PATH = path.join(__dirname, '../../database/vars.json');

function readJSON(file, fallback = {}) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { return fallback; }
}
function writeJSON(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
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
    } catch { return false; }
}

if (!global.mutedUsers) {
    global.mutedUsers = new Map();
    const saved = readJSON(MUTE_PATH);
    for (const [groupJid, users] of Object.entries(saved)) {
        const now = Date.now();
        const active = {};
        for (const [userJid, expiry] of Object.entries(users)) {
            if (expiry > now) {
                active[userJid] = expiry;
            }
        }
        if (Object.keys(active).length > 0) {
            global.mutedUsers.set(groupJid, active);
        }
    }
}

function saveMutes() {
    const obj = {};
    for (const [groupJid, users] of global.mutedUsers) {
        obj[groupJid] = users;
    }
    writeJSON(MUTE_PATH, obj);
}

(function attachMuteListener() {
    if (!global.sock) return setTimeout(attachMuteListener, 500);
    global.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const groupJid = msg.key.remoteJid;
            if (!groupJid || !groupJid.endsWith('@g.us')) continue;
            const senderJid = msg.key.participant || msg.key.remoteJid;
            if (!senderJid) continue;
            const muted = global.mutedUsers.get(groupJid);
            if (!muted || !muted[senderJid]) continue;

            const expiry = muted[senderJid];
            if (Date.now() >= expiry) {
                delete muted[senderJid];
                if (Object.keys(muted).length === 0) {
                    global.mutedUsers.delete(groupJid);
                }
                saveMutes();
                continue;
            }

            try {
                await global.sock.sendMessage(groupJid, { delete: msg.key });
            } catch (err) {
                console.error('[muteuser] delete error:', err.message);
            }
        }
    });
    console.log('[muteuser] listener active');
})();

function parseDuration(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)\s*(m|h)$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    return null;
}

module.exports = {
    name: 'muteuser',
    aliases: ['unmuteuser'],
    category: 'Group',
    desc: 'Silence a user for a set time (delete their messages). .muteuser <duration> @user / .unmuteuser @user',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This command only works in groups.' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);
        const parts = rawText.slice(prefix.length).trim().split(/\s+/);
        const command = parts.shift().toLowerCase();

        const meta = await sock.groupMetadata(from);
        const isGroupAdmin = meta.participants.some(p =>
        p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        const allowed = isGroupAdmin || perms?.isOwner || isSudoOrOwner(senderJid);
        if (!allowed)
            return sock.sendMessage(from, { text: '❌ Only *Group Admins*, *Sudo*, or *Owner* can use this command.' });

        if (command === 'unmuteuser') {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const targetJid = contextInfo?.mentionedJid?.[0] || contextInfo?.participant;
            if (!targetJid)
                return sock.sendMessage(from, { text: '❌ Please mention or reply to the user you want to unmute.' });

            const groupMutes = global.mutedUsers.get(from);
            if (!groupMutes || !groupMutes[targetJid])
                return sock.sendMessage(from, { text: '❌ That user is not muted in this group.' });

            delete groupMutes[targetJid];
            if (Object.keys(groupMutes).length === 0) {
                global.mutedUsers.delete(from);
            }
            saveMutes();
            await sock.sendMessage(from, {
                text: `🔊 Unmuted @${targetJid.split('@')[0]}`,
                                   mentions: [targetJid]
            });
            return;
        }

        if (command !== 'muteuser') return;

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const targetJid = contextInfo?.mentionedJid?.[0] || contextInfo?.participant;
        if (!targetJid)
            return sock.sendMessage(from, { text: '❌ Please mention or reply to the user you want to mute.' });

        if (targetJid === senderJid)
            return sock.sendMessage(from, { text: '❌ You cannot mute yourself.' });

        const durationStr = parts[0];
        const durationMs = parseDuration(durationStr);
        if (!durationMs)
            return sock.sendMessage(from, { text: '❌ Please specify a valid duration (e.g., 30m, 2h).\nUsage: `.muteuser 30m @user`' });

        const expiry = Date.now() + durationMs;

        if (!global.mutedUsers.has(from)) {
            global.mutedUsers.set(from, {});
        }
        const groupMutes = global.mutedUsers.get(from);
        groupMutes[targetJid] = expiry;
        saveMutes();

        setTimeout(async () => {
            const grp = global.mutedUsers.get(from);
            if (grp && grp[targetJid] === expiry) {
                delete grp[targetJid];
                if (Object.keys(grp).length === 0) {
                    global.mutedUsers.delete(from);
                }
                saveMutes();
            }
        }, durationMs);

        const mins = Math.floor(durationMs / 60000);
        const display = mins >= 60 ? `${mins / 60}h` : `${mins}m`;

        await sock.sendMessage(from, {
            text: `🔇 Muted @${targetJid.split('@')[0]} for *${display}*. Their messages will be deleted.`,
                               mentions: [targetJid]
        });
    }
};
