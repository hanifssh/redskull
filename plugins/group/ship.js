const fs = require('fs');
const path = require('path');

function readJSON(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return fallback; }
}
function writeJSON(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getDisplayName(jid, meta) {
    const participant = meta.participants.find(p => p.id === jid);
    if (participant) {
        const notify = participant.notify;
        if (notify && notify.length > 0) return notify;
    }
    return jid.split('@')[0].replace(/\D/g, '').slice(-8);
}

function getLoveMessage(percentage) {
    if (percentage >= 90) return "💘 *Soulmates!* A match made in heaven. Get a room already!";
    if (percentage >= 70) return "💕 *Strong connection.* The sparks are real, don't waste it!";
    if (percentage >= 50) return "💛 *Halfway there.* Maybe worth a coffee date?";
    if (percentage >= 30) return "💔 *It's complicated.* You'll fight more than talk.";
    if (percentage >= 10) return "💀 *Almost enemies.* This ship is barely floating.";
    return "☠️ *DOA.* Don't even stand next to each other.";
}

module.exports = {
    name: 'ship',
    aliases: [],
    category: 'Group',
    desc: 'Ship two random group members or two mentioned users',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This command only works in groups.' });

        const meta = await sock.groupMetadata(from);
        const botNum = sock.user.id.split(':')[0].replace(/\D/g, '');
        const members = meta.participants.filter(p => !p.id.replace(/\D/g, '').includes(botNum));

        if (members.length < 2)
            return sock.sendMessage(from, { text: '❌ Need at least 2 other members to ship.' });

        let person1, person2;
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;

        if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length >= 2) {
            person1 = contextInfo.mentionedJid[0];
            person2 = contextInfo.mentionedJid[1];
        } else if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length === 1) {
            person1 = contextInfo.mentionedJid[0];
            const others = members.filter(m => m.id !== person1);
            if (others.length === 0) {
                return sock.sendMessage(from, { text: '❌ Not enough other members to ship with.' });
            }
            person2 = others[Math.floor(Math.random() * others.length)].id;
        } else {
            const shuffled = [...members].sort(() => Math.random() - 0.5);
            person1 = shuffled[0].id;
            person2 = shuffled[1].id;
        }

        const name1 = getDisplayName(person1, meta);
        const name2 = getDisplayName(person2, meta);

        const dateKey = new Date().toISOString().slice(0, 10);
        const hash = (person1 + person2 + dateKey).split('').reduce((h, c) => h + c.charCodeAt(0), 0);
        const percentage = (hash % 101);

        const loveMsg = getLoveMessage(percentage);
        const hearts = percentage >= 90 ? '❤️‍🔥' : percentage >= 70 ? '💖' : percentage >= 50 ? '💛' : percentage >= 30 ? '💔' : '🖤';

        const text =
        `╭━─━─━─≪ ⚓ ≫─━─━─━╮\n` +
        `│   *SHIP METER* ${hearts}\n` +
        `╰━─━─━─≪ ⚓ ≫─━─━─━╯\n\n` +
        `💑 @${person1.split('@')[0]}  ×  @${person2.split('@')[0]}\n\n` +
        `📊 *Love:* ${'█'.repeat(Math.floor(percentage / 10))}${'░'.repeat(10 - Math.floor(percentage / 10))} ${percentage}%\n\n` +
        `${loveMsg}\n\n` +
        `╰━─━─━─≪ 💘 ≫─━─━─━╯`;

        await sock.sendMessage(from, {
            text,
            mentions: [person1, person2]
        });
    }
};
