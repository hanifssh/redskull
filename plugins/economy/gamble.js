const { readEco, writeEco, initUser } = require('./_db');

const EMOJIS = ['🍒', '💰', '🍀', '💎', '🔥', '⭐', '7️⃣'];

function randomSlot() {
    return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function spinRow() {
    return `${randomSlot()} ${randomSlot()} ${randomSlot()}`;
}

function spinGrid() {
    return `${spinRow()}\n${spinRow()}\n${spinRow()}`;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function checkWin(gridText) {
    const rows = gridText.trim().split('\n').map(r => r.trim().split(/\s+/));
    if (rows.length !== 3 || rows.some(r => r.length !== 3)) {
        return { won: false, multiplier: 0 };
    }

    const lines = [];

    for (let r = 0; r < 3; r++) {
        if (rows[r][0] === rows[r][1] && rows[r][1] === rows[r][2]) {
            lines.push({ type: 'row', index: r });
        }
    }
    for (let c = 0; c < 3; c++) {
        if (rows[0][c] === rows[1][c] && rows[1][c] === rows[2][c]) {
            lines.push({ type: 'col', index: c });
        }
    }
    if (rows[0][0] === rows[1][1] && rows[1][1] === rows[2][2]) {
        lines.push({ type: 'diag', index: 1 }); // top‑left → bottom‑right
    }
    if (rows[0][2] === rows[1][1] && rows[1][1] === rows[2][0]) {
        lines.push({ type: 'diag', index: 2 }); // top‑right → bottom‑left
    }

    if (lines.length === 0) return { won: false, multiplier: 0 };

    const multipliers = {
        row:    [2, 5, 2],
        col:    [1.5, 1.5, 1.5],
        diag:   [3, 3]
    };

    let maxMult = 0;
    lines.forEach(line => {
        let mult = multipliers[line.type]?.[line.index] || 0;
        if (line.type === 'diag') mult = multipliers.diag[line.index === 1 ? 0 : 1];
        if (mult > maxMult) maxMult = mult;
    });

        return { won: true, multiplier: maxMult };
}
// ────────────────────────────────────────────────────────────

module.exports = {
    name:     'gamble',
    aliases:  [],
    category: 'Economy',
    desc:     'Spin the slot machine and risk your cash! (.gamble <amount|all>)',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ Economy commands only work inside Groups!' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText   = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix    = rawText.charAt(0);

        const db   = readEco();
        const user = initUser(db, senderJid, msg.pushName || 'User');

        if (!args[0])
            return sock.sendMessage(from, { text: `👉 Usage: \`${prefix}gamble <amount>\` or \`${prefix}gamble all\`` });

        let bet = args[0].toLowerCase() === 'all' ? user.wallet : parseInt(args[0]);

        if (isNaN(bet) || bet <= 0)
            return sock.sendMessage(from, { text: '❌ Enter a valid bet amount.' });

        if (user.wallet < bet)
            return sock.sendMessage(from, { text: `❌ Not enough cash! You have *${user.wallet} 💵* in wallet.` });

        if (bet < 50)
            return sock.sendMessage(from, { text: '❌ Minimum bet is *50 💵*.' });

        const sent = await sock.sendMessage(from, {
            text: `🎰 *SLOT MACHINE* 🎰\n\n${spinGrid()}\n\n_Spinning..._`
        });

        for (let i = 0; i < 3; i++) {
            await sleep(600);
            await sock.sendMessage(from, {
                text: `🎰 *SLOT MACHINE* 🎰\n\n${spinGrid()}\n\n_Spinning..._`,
                                   edit: sent.key
            });
        }

        const finalGrid = spinGrid();
        const outcome   = checkWin(finalGrid);

        if (outcome.won) {
            const winnings = Math.floor(bet * outcome.multiplier);
            user.wallet += winnings;
            writeEco(db);
            await sleep(600);
            await sock.sendMessage(from, {
                text:
                `🎰 *SLOT MACHINE* 🎰\n\n${finalGrid}\n\n` +
                `╭━─━─━─≪ 🎉 ≫─━─━─━╮\n` +
                `│  *JACKPOT — YOU WIN!*\n` +
                `│ ✗ *Bet:*     ${bet.toLocaleString()} 💵\n` +
                `│ ✗ *Won:*     +${winnings.toLocaleString()} 💵 (${outcome.multiplier}x)\n` +
                `│ ✗ *Wallet:*  ${user.wallet.toLocaleString()} 💵\n` +
                `╰━─━─━─≪ 👑 ≫─━─━─━╯`,
                edit: sent.key
            });
        } else {
            user.wallet -= bet;
            writeEco(db);
            await sleep(600);
            await sock.sendMessage(from, {
                text:
                `🎰 *SLOT MACHINE* 🎰\n\n${finalGrid}\n\n` +
                `╭━─━─━─≪ 💀 ≫─━─━─━╮\n` +
                `│    *BETTER LUCK NEXT TIME*\n` +
                `│ ✗ *Lost:*    -${bet.toLocaleString()} 💵\n` +
                `│ ✗ *Wallet:* ${user.wallet.toLocaleString()} 💵\n` +
                `╰━─━─━─≪ 😭 ≫─━─━─━╯`,
                edit: sent.key
            });
        }
    }
};
