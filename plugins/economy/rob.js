const { readEco, writeEco, initUser, getPrefix } = require('./_db');

const ROB_COOLDOWN = 5 * 60 * 1000;
const robCooldowns = new Map();

module.exports = {
    name: 'rob',
    aliases: [],
    category: 'Economy',
    desc: 'Attempt to rob another player\'s wallet — .rob @user',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText   = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix    = rawText.charAt(0);

        const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
                    || msg.message?.extendedTextMessage?.contextInfo?.participant;

        if (!target)
            return sock.sendMessage(from, { text: `👉 Usage: \`${prefix}rob @user\`` });

        if (target === senderJid)
            return sock.sendMessage(from, { text: '❌ You can\'t rob yourself, genius.' });

        const lastRob = robCooldowns.get(senderJid) || 0;
        const diff    = Date.now() - lastRob;
        if (diff < ROB_COOLDOWN) {
            const secs = Math.ceil((ROB_COOLDOWN - diff) / 1000);
            return sock.sendMessage(from, { text: `⏳ Lay low! You can rob again in *${secs}s*.` });
        }

        const db      = readEco();
        const robber  = await initUser(sock, db, senderJid, msg.pushName || 'Robber');
        if (!robber.registered) {
            return sock.sendMessage(from, {
                text: `❌ You haven't registered for the economy yet!\nType \`${getPrefix()}register\` to join.`
            }, { quoted: msg });
        }
        const victim  = await initUser(sock, db, target, 'Victim');

        if (victim.wallet < 100)
            return sock.sendMessage(from, { text: '❌ That person is too broke to rob! They have less than *100 💵* on hand.' });

        robCooldowns.set(senderJid, Date.now());

        const targetNum = target.split('@')[0];
        const robberNum = senderJid.split('@')[0];

        const success = Math.random() < 0.45;

        if (success) {
            const stolen   = Math.floor(victim.wallet * (0.2 + Math.random() * 0.3));
            victim.wallet -= stolen;
            robber.wallet += stolen;
            writeEco(db);

            await sock.sendMessage(from, {
                text:
                    `╭━─━─━─≪ 🔫 ≫─━─━─━╮\n` +
                    `│   *SUCCESSFUL ROBBERY!*\n` +
                    `╰━─━─━─≪ 🔫 ≫─━─━─━╯\n` +
                    `│ ✗ *Robber:* @${robberNum}\n` +
                    `│ ✗ *Victim:* @${targetNum}\n` +
                    `│ ✗ *Stolen:* ${stolen.toLocaleString()} 💵\n` +
                    `│ 🏃 Got away clean!\n` +
                    `╰━─━─━─≪ 💰 ≫─━─━─━╯`,
                mentions: [senderJid, target]
            });
        } else {
            const fine     = Math.max(50, Math.floor(robber.wallet * (0.1 + Math.random() * 0.15)));
            const actualFine = Math.min(fine, robber.wallet);
            robber.wallet -= actualFine;
            writeEco(db);

            await sock.sendMessage(from, {
                text:
                    `╭━─━─━─≪ 🚔 ≫─━─━─━╮\n` +
                    `│   *ROBBERY FAILED!*\n` +
                    `╰━─━─━─≪ 🚔 ≫─━─━─━╯\n` +
                    `│ @${robberNum} tried to rob @${targetNum}!\n` +
                    `│ Got caught by police! 🚨\n` +
                    `│ ✗ *Fine paid:* -${actualFine.toLocaleString()} 💵\n` +
                    `╰━─━─━─≪ 😭 ≫─━─━─━╯`,
                mentions: [senderJid, target]
            });
        }
    }
};
