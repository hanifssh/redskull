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
    name: 'demote',
    aliases: [],
    category: 'Group',
    desc: 'Demote an admin to regular member',
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
            return sock.sendMessage(from, { text: '❌ Only *Group Admins*, *Sudo*, or *Owner* can use this command.' });

        let targetJid = null;
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        if (contextInfo?.mentionedJid?.length) {
            targetJid = contextInfo.mentionedJid[0];
        } else if (contextInfo?.participant) {
            targetJid = contextInfo.participant;
        } else if (args[0]?.includes('@')) {
            const num = args[0].replace(/[^0-9]/g, '');
            if (num) targetJid = num + '@s.whatsapp.net';
        }

        if (!targetJid)
            return sock.sendMessage(from, { text: `❌ Please mention or reply to the admin you want to demote.\nUsage: \`${prefix}demote @user\`` });

        if (targetJid === senderJid)
            return sock.sendMessage(from, { text: '❌ You cannot demote yourself.' });

        const targetParticipant = meta.participants.find(p => p.id === targetJid);
        if (!targetParticipant)
            return sock.sendMessage(from, { text: '❌ That person is not a member of this group.' });

        if (targetParticipant.admin !== 'admin' && targetParticipant.admin !== 'superadmin')
            return sock.sendMessage(from, { text: '❌ That person is not an admin.' });

        try {
            await sock.groupParticipantsUpdate(from, [targetJid], 'demote');
            await sock.sendMessage(from, {
                text: `⬇️ @${targetJid.split('@')[0]} has been demoted from admin.`,
                                   mentions: [targetJid]
            });
        } catch (err) {
            await sock.sendMessage(from, {
                text: `❌ Failed to demote @${targetJid.split('@')[0]}. Make sure I'm an admin.`,
                                   mentions: [targetJid]
            });
        }
    }
};
