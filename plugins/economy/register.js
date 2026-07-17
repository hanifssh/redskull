const { readEco, writeEco, initUser } = require('./_db');

module.exports = {
    name: 'register',
    aliases: [],
    category: 'Economy',
    desc: 'Join the economy system. Required to use other economy commands.',
    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const db = readEco();
        const user = await initUser(sock, db, senderJid, msg.pushName || 'User');

        if (user.registered) {
            return sock.sendMessage(from, { text: '✅ You are already registered!' }, { quoted: msg });
        }

        user.registered = true;
        user.wallet += 1000;
        user.orbs += 10;
        writeEco(db);

        await sock.sendMessage(from, {
            text: `🎉 *Welcome to the RedSkull Economy, ${user.name}!*\n\nYou received *+1000 💵* and *+10 🔮 Orbs* as a welcome bonus.\n\nUse .menu to see all economy commands.`
        }, { quoted: msg });
    }
};
