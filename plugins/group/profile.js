const axios = require('axios');

async function resolveJid(sock, jid) {
    if (!jid) return jid;
    jid = jid.split(':')[0];
    if (!jid.includes('@')) jid += '@s.whatsapp.net';

    if (jid.endsWith('@lid')) {
        try {
            const mappedPn = await sock.signalRepository?.lidMapping?.getPNForLID(jid);
            if (mappedPn) return mappedPn.split(':')[0].split('@')[0] + '@s.whatsapp.net';
        } catch {}
        try {
            const contact = await sock.getContact?.(jid);
            if (contact?.pn) {
                const cleanPn = contact.pn.split(':')[0];
                return cleanPn.includes('@') ? cleanPn : cleanPn + '@s.whatsapp.net';
            }
        } catch {}
    }
    return jid;
}

async function fetchName(sock, from, realJid, targetJid) {
    if (from.endsWith('@g.us')) {
        try {
            const meta = await sock.groupMetadata(from);
            const p = meta.participants.find(x =>
            x.id === targetJid ||
            x.id === realJid ||
            x.id.split(':')[0] === targetJid ||
            x.id.split(':')[0] === realJid ||
            x.phoneNumber === realJid ||
            x.phoneNumber === targetJid
            );
            if (p?.notify) return p.notify;
            if (p?.name) return p.name;
        } catch {}
    }

    try {
        const res = await sock.onWhatsApp(realJid);
        if (res?.[0]?.notify) return res[0].notify;
    } catch {}

    try {
        const contact = await sock.getContact?.(realJid);
        if (contact) {
            const n = contact.notify || contact.name || contact.pushName;
            if (n) return n;
        }
    } catch {}

    try {
        const contact = await sock.getContact?.(targetJid);
        if (contact) {
            const n = contact.notify || contact.name || contact.pushName;
            if (n) return n;
        }
    } catch {}

    return null;
}

async function fetchAbout(sock, realJid, targetJid) {
    const tryFetch = async (jid) => {
        try {
            const arr = await sock.fetchStatus(jid);
            if (arr?.[0]?.status?.status) {
                const s = arr[0].status;
                return {
                    text: s.status,
                    setAt: s.setAt ? new Date(s.setAt) : null
                };
            }
        } catch {}
        return null;
    };

    let r = await tryFetch(realJid);
    if (!r?.text) r = await tryFetch(targetJid);
    return r || { text: null, setAt: null };
}

module.exports = {
    name: 'profile',
    aliases: ['pfp', 'whois'],
    category: 'Tools',
    desc: 'Show profile info of a user.\n.profile → your own\n.profile @user → mentioned user\n.profile (reply) → replied user',

    execute: async (sock, from, msg, args) => {
        const senderJid = msg.key.participant || msg.key.remoteJid;
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;

        let targetJid = senderJid;
        if (contextInfo?.mentionedJid?.[0]) targetJid = contextInfo.mentionedJid[0];
        else if (contextInfo?.participant) targetJid = contextInfo.participant;

        const realJid = await resolveJid(sock, targetJid);
        const number = realJid.split('@')[0].replace(/\D/g, '');

        const name = await fetchName(sock, from, realJid, targetJid);
        const about = await fetchAbout(sock, realJid, targetJid);

        let ppUrl = null;
        try {
            ppUrl = await sock.profilePictureUrl(realJid, 'image', 10000);
        } catch {
            try {
                ppUrl = await sock.profilePictureUrl(targetJid, 'image', 10000);
            } catch {}
        }

        let text =
        `╭━─━─━─≪ ✠ ≫─━─━─━╮\n` +
        `│    *PROFILE CARD*\n` +
        `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
        `│\n` +
        `│ ✗ *Name:*     ${name || 'Not available'}\n` +
        `│ ✗ *Number:*   +${number}\n` +
        `│ ✗ *About:*    ${about.text || 'Not available'}\n`;

        if (about.setAt) {
            const d = about.setAt;
            const date = d.toLocaleDateString('en-GB');
            const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            text += `│ ✗ *Set On:*   ${date} at ${time}\n`;
        }

        text +=
        `│ ✗ *PFP:*      ${ppUrl ? 'Available' : 'Hidden or not set'}\n` +
        `│\n╰━─━─━─≪ ✠ ≫─━─━─━╯`;

        try {
            if (ppUrl) {
                const pfp = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 15000 });
                await sock.sendMessage(from, {
                    image: Buffer.from(pfp.data),
                                       caption: text,
                                       mentions: [targetJid]
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text, mentions: [targetJid] }, { quoted: msg });
            }
        } catch (err) {
            console.error('[profile] send error:', err.message);
            await sock.sendMessage(from, { text, mentions: [targetJid] }, { quoted: msg });
        }
    }
};
