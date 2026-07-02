const fs = require('fs');
const path = require('path');

const VARS_PATH = path.join(__dirname, '../../database/vars.json');

function readJSON(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return fallback; }
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

module.exports = {
    name: 'mute',
    aliases: [],
    category: 'Group',
    desc: 'Only admins can send messages',
    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This command only works in groups.' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const meta = await sock.groupMetadata(from);
        const isGroupAdmin = meta.participants.some(p =>
        p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        const allowed = isGroupAdmin || perms?.isOwner || isSudoOrOwner(senderJid);
        if (!allowed)
            return sock.sendMessage(from, { text: '❌ Only *Group Admins*, *Sudo*, or *Owner* can mute the group.' });

        try {
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: '🔇 Group muted. Only admins can send messages now.' });
        } catch (err) {
            await sock.sendMessage(from, { text: '❌ Failed to mute the group. Make sure I am an admin.' });
        }
    }
};
