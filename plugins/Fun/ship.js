const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'ship',
    aliases: [],
    category: 'Fun',
    desc: 'Ship two group members.\n.ship → two random people\n.ship me → you + random\n.ship me @user → you + mentioned\n.ship @user @user → two mentioned',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This command only works in groups.' }, { quoted: msg });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const meta = await sock.groupMetadata(from);
        const botNum = sock.user.id.split(':')[0].replace(/\D/g, '');
        const members = meta.participants.filter(p => !p.id.replace(/\D/g, '').includes(botNum));

        if (members.length < 2)
            return sock.sendMessage(from, { text: '❌ Need at least 2 other members to ship.' }, { quoted: msg });

        let person1, person2;
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const mentionedJids = contextInfo?.mentionedJid || [];
        const firstArg = args[0]?.toLowerCase();

        if (firstArg === 'me' && mentionedJids.length >= 1) {
            person1 = senderJid;
            person2 = mentionedJids[0];
        } else if (firstArg === 'me') {
            person1 = senderJid;
            const others = members.filter(m => m.id !== senderJid);
            if (others.length === 0) {
                return sock.sendMessage(from, { text: '❌ No other members to ship with.' }, { quoted: msg });
            }
            person2 = others[Math.floor(Math.random() * others.length)].id;
        } else if (mentionedJids.length >= 2) {
            person1 = mentionedJids[0];
            person2 = mentionedJids[1];
        } else if (mentionedJids.length === 1) {
            person1 = mentionedJids[0];
            const others = members.filter(m => m.id !== person1);
            if (others.length === 0) {
                return sock.sendMessage(from, { text: '❌ Not enough other members to ship with.' }, { quoted: msg });
            }
            person2 = others[Math.floor(Math.random() * others.length)].id;
        } else {
            const shuffled = [...members].sort(() => Math.random() - 0.5);
            person1 = shuffled[0].id;
            person2 = shuffled[1].id;
        }

        const dateKey = new Date().toISOString().slice(0, 10);
        const hash = (person1 + person2 + dateKey).split('').reduce((h, c) => h + c.charCodeAt(0), 0);
        const percentage = hash % 101;

        let loveMsg;
        if (percentage >= 90) loveMsg = "💘 *Soulmates!* A match made in heaven. Get a room already!";
        else if (percentage >= 70) loveMsg = "💕 *Strong connection.* The sparks are real, don't waste it!";
        else if (percentage >= 50) loveMsg = "💛 *Halfway there.* Maybe worth a coffee date?";
        else if (percentage >= 30) loveMsg = "💔 *It's complicated.* You'll fight more than talk.";
        else if (percentage >= 10) loveMsg = "💀 *Almost enemies.* This ship is barely floating.";
        else loveMsg = "☠️ *DOA.* Don't even stand next to each other.";

        const hearts = percentage >= 90 ? '❤️‍🔥' : percentage >= 70 ? '💖' : percentage >= 50 ? '💛' : percentage >= 30 ? '💔' : '🖤';
        const bar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));

        const text =
        `╭━─━─━─≪ ⚓ ≫─━─━─━╮\n` +
        `│   *SHIP METER* ${hearts}\n` +
        `╰━─━─━─≪ ⚓ ≫─━─━─━╯\n\n` +
        `💑 @${person1.split('@')[0]}  ×  @${person2.split('@')[0]}\n\n` +
        `📊 *Love:* ${bar} ${percentage}%\n\n` +
        `${loveMsg}\n\n` +
        `╰━─━─━─≪ 💘 ≫─━─━─━╯`;

        await sock.sendMessage(from, {
            text,
            mentions: [person1, person2]
        }, { quoted: msg });
    }
};
