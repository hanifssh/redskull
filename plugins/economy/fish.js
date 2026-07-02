const { readEco, writeEco, initUser } = require('./_db');

const COOLDOWN = 30_000;

const FISH_OUTCOMES = [
    { weight: 10, type: 'nothing', msg: '🌊 The fish stole your bait! Nothing caught today.' },
    { weight: 5,  type: 'nothing', msg: '🎣 Your line snapped. No catch this time.' },
    { weight: 30, type: 'cash',    min: 50,  max: 250,  msg: '🐟 Reeled in a small fish worth *{amount} 💵*!' },
    { weight: 25, type: 'cash',    min: 150, max: 500,  msg: '🐠 Caught a rare tropical fish worth *{amount} 💵*!' },
    { weight: 20, type: 'cash',    min: 300, max: 800,  msg: '🦈 Massive shark catch! Sold for *{amount} 💵*!' },
    { weight: 8,  type: 'orbs',   min: 1,   max: 2,    msg: '🔮 Pulled up a sunken chest with *{amount} Anime Orb(s)*!' },
    { weight: 2,  type: 'orbs',   min: 2,   max: 5,    msg: '🌟 Legendary underwater relic! *{amount} Orbs* found!' },
];

function pickOutcome() {
    const total = FISH_OUTCOMES.reduce((s, o) => s + o.weight, 0);
    let rand    = Math.floor(Math.random() * total);
    for (const o of FISH_OUTCOMES) {
        rand -= o.weight;
        if (rand < 0) return o;
    }
    return FISH_OUTCOMES[0];
}

module.exports = {
    name:     'fish',
    aliases:  [],
    category: 'Economy',
    desc:     'Cast your line and fish for cash or orbs! (30 second cooldown)',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const db        = readEco();
        const user      = initUser(db, senderJid, msg.pushName || 'User');

        const diff = Date.now() - user.lastFish;
        if (diff < COOLDOWN) {
            const secs = Math.ceil((COOLDOWN - diff) / 1000);
            return sock.sendMessage(from, { text: `⏳ Rod recharging! Wait *${secs}s* before casting again.` });
        }

        user.lastFish = Date.now();

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
