const { readEco, writeEco, initUser, getPrefix } = require('./_db');

const COOLDOWN = 30_000;

const DIG_OUTCOMES = [
    { weight: 5,  type: 'nothing', msg: '🪱 You dug deep and found nothing but dirt and worms.' },
    { weight: 5,  type: 'nothing', msg: '🕳️ Empty hole. The earth mocks you.' },
    { weight: 30, type: 'cash',    min: 50,  max: 200,  msg: '⛏️ You dug up *{amount} 💵* buried in the ground!' },
    { weight: 30, type: 'cash',    min: 100, max: 400,  msg: '💰 Found a buried stash of *{amount} 💵*!' },
    { weight: 20, type: 'cash',    min: 300, max: 700,  msg: '🏺 Ancient pottery with *{amount} 💵* inside!' },
    { weight: 8,  type: 'orbs',   min: 1,   max: 2,    msg: '🔮 Mystical excavation! Uncovered *{amount} Orb(s)*!' },
    { weight: 2,  type: 'orbs',   min: 2,   max: 4,    msg: '✨ Rare discovery! A glowing crystal worth *{amount} Orb(s)*!' },
];

function pickOutcome() {
    const total = DIG_OUTCOMES.reduce((s, o) => s + o.weight, 0);
    let rand    = Math.floor(Math.random() * total);
    for (const o of DIG_OUTCOMES) {
        rand -= o.weight;
        if (rand < 0) return o;
    }
    return DIG_OUTCOMES[0];
}

module.exports = {
    name: 'dig',
    aliases: [],
    category: 'Economy',
    desc: 'Dig for hidden cash or orbs! (30 second cooldown)',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const db = readEco();
        const user = await initUser(sock, db, senderJid, msg.pushName || 'User');
        if (!user.registered) {
            return sock.sendMessage(from, {
                text: `❌ You haven't registered for the economy yet!\nType \`${getPrefix()}register\` to join.`
            }, { quoted: msg });
        }

        const diff = Date.now() - user.lastDig;
        if (diff < COOLDOWN) {
            const secs = Math.ceil((COOLDOWN - diff) / 1000);
            return sock.sendMessage(from, { text: `⏳ Shovel recharging! Wait *${secs}s* before digging again.` });
        }

        user.lastDig = Date.now();

        const outcome = pickOutcome();
        let replyMsg  = '';

        if (outcome.type === 'nothing') {
            replyMsg = outcome.msg;
        } else if (outcome.type === 'cash') {
            const amount  = Math.floor(Math.random() * (outcome.max - outcome.min + 1)) + outcome.min;
            user.wallet  += amount;
            replyMsg      = outcome.msg.replace('{amount}', amount.toLocaleString());
        } else if (outcome.type === 'orbs') {
            const amount = Math.floor(Math.random() * (outcome.max - outcome.min + 1)) + outcome.min;
            user.orbs   += amount;
            replyMsg     = outcome.msg.replace('{amount}', amount);
        }

        writeEco(db);
        await sock.sendMessage(from, { text: replyMsg });
    }
};
