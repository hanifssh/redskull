const { readEco, writeEco, initUser, getPrefix } = require('./_db');

if (!global.pendingBattles) global.pendingBattles = new Map();
const CHALLENGE_TIMEOUT = 10 * 60 * 1000;

function getDisplayName(db, jid, fallback) {
    const user = db.users[jid];
    if (user?.name && user.name !== 'User') return user.name;
    return fallback || jid.split('@')[0].replace(/\D/g, '').slice(-8);
}

async function getOpponentName(sock, db, jid) {
    if (typeof sock.getContact === 'function') {
        try {
            const contact = await sock.getContact(jid);
            if (contact) {
                const name = contact.notify || contact.name || contact.pushName;
                if (name && name !== 'undefined') return name;
            }
        } catch {}
    }
    return getDisplayName(db, jid, 'Opponent');
}

module.exports = {
    name: 'battle',
    aliases: ['accept', 'deny'],
    category: 'Economy',
    desc: 'Battle another player. .battle @user <card> | .accept <card> | .deny',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This command only works in groups.' });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const prefix = rawText.charAt(0);
        const command = rawText.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();

        const db = readEco();

        if (command === 'battle') {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const opponentJid = contextInfo?.mentionedJid?.[0] || contextInfo?.participant;
            if (!opponentJid) {
                return sock.sendMessage(from, {
                    text: '❌ Please mention or reply to the user you want to battle.\nUsage: `.battle @user <your card>`'
                });
            }
            if (opponentJid === senderJid) {
                return sock.sendMessage(from, { text: '❌ You cannot battle yourself!' });
            }

            const mentionNum = opponentJid.split('@')[0].replace(/\D/g, '');
            const parts = rawText.split(/\s+/).slice(1);
            const cardNameParts = parts.filter(p => !p.startsWith('@') && !p.includes(mentionNum));
            const yourCardName = cardNameParts.join(' ').trim();
            if (!yourCardName) {
                return sock.sendMessage(from, {
                    text: '❌ Please specify your Pokémon card name.\nUsage: `.battle @user Charizard`'
                });
            }

            const you = await initUser(sock, db, senderJid, msg.pushName || 'User');
            if (!you.registered) {
                return sock.sendMessage(from, {
                    text: `❌ You haven't registered for the economy yet!\nType \`${getPrefix()}register\` to join.`
                }, { quoted: msg });
            }
            const yourCard = you.pokemonDeck.find(c => c.name.toLowerCase() === yourCardName.toLowerCase());
            if (!yourCard) {
                return sock.sendMessage(from, { text: `❌ You don't have a card named *${yourCardName}*.` });
            }

            const key = `${from}_${opponentJid}`;
            if (global.pendingBattles.has(key)) {
                return sock.sendMessage(from, { text: '❌ That user already has a pending battle challenge.' });
            }

            global.pendingBattles.set(key, {
                challengerJid: senderJid,
                challengerCard: yourCardName,
                timestamp: Date.now(),
            });

            const opponentName = await getOpponentName(sock, db, opponentJid);
            const yourName = getDisplayName(db, senderJid, msg.pushName || 'You');

            await sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ ⚔️ ≫─━─━─━╮\n` +
                `│   *BATTLE CHALLENGE!*\n` +
                `╰━─━─━─≪ ⚔️ ≫─━─━─━╯\n\n` +
                `🔥 ${yourName} challenges @${opponentJid.split('@')[0]} to a battle!\n\n` +
                `⏳ *${opponentName}*, reply with:\n` +
                `\`${prefix}accept <your card name>\` – to fight\n` +
                `\`${prefix}deny\` – to cancel\n\n` +
                `_Challenge expires in 10 minutes._`,
                mentions: [opponentJid]
            });
            return;
        }

        if (command === 'accept') {
            const key = `${from}_${senderJid}`;
            const challenge = global.pendingBattles.get(key);

            if (!challenge) {
                return sock.sendMessage(from, { text: '❌ You have no pending battle challenge.' });
            }

            if (Date.now() - challenge.timestamp > CHALLENGE_TIMEOUT) {
                global.pendingBattles.delete(key);
                return sock.sendMessage(from, { text: '⏳ Your challenge has expired.' });
            }

            const opponentCardName = args.join(' ').trim();
            if (!opponentCardName) {
                return sock.sendMessage(from, {
                    text: '❌ Please specify your Pokémon card name.\nUsage: `.accept <card name>`'
                });
            }

            const opponentData = await initUser(sock, db, senderJid);
            if (!opponentData.registered) {
                return sock.sendMessage(from, {
                    text: `❌ You haven't registered for the economy yet!\nType \`${getPrefix()}register\` to join.`
                }, { quoted: msg });
            }
            const opponentCard = opponentData.pokemonDeck.find(c => c.name.toLowerCase() === opponentCardName.toLowerCase());
            if (!opponentCard) {
                return sock.sendMessage(from, { text: `❌ You don't have a card named *${opponentCardName}*.` });
            }

            const challengerData = await initUser(sock, db, challenge.challengerJid);
            const challengerCard = challengerData.pokemonDeck.find(c => c.name.toLowerCase() === challenge.challengerCard.toLowerCase());
            if (!challengerCard) {
                global.pendingBattles.delete(key);
                return sock.sendMessage(from, { text: '❌ The challenger no longer has that card. Challenge cancelled.' });
            }

            global.pendingBattles.delete(key);

            const challengerPower = (challengerCard.hp || 100) * (challengerCard.level || 1);
            const opponentPower = (opponentCard.hp || 100) * (opponentCard.level || 1);

            const challengerName = getDisplayName(db, challenge.challengerJid, 'Challenger');
            const opponentName = getDisplayName(db, senderJid, 'Opponent');

            if (challengerPower === opponentPower) {
                return sock.sendMessage(from, {
                    text:
                    `╭━─━─━─≪ ⚔️ ≫─━─━─━╮\n` +
                    `│   *BATTLE DRAW!*\n` +
                    `╰━─━─━─≪ ⚔️ ≫─━─━─━╯\n\n` +
                    `⚡ ${challengerName} (${challengerCard.name} Lv.${challengerCard.level || 1}) : ${challengerPower} vs ${opponentPower} : ${opponentCard.name} Lv.${opponentCard.level || 1} ${opponentName}\n\n` +
                    `It's a tie!`,
                    mentions: [challenge.challengerJid, senderJid]
                });
            }

            const challengerWins = challengerPower > opponentPower;
            const winnerJid = challengerWins ? challenge.challengerJid : senderJid;
            const loserJid = challengerWins ? senderJid : challenge.challengerJid;
            const winnerCard = challengerWins ? challengerCard : opponentCard;
            const loserCard = challengerWins ? opponentCard : challengerCard;
            const winnerName = challengerWins ? challengerName : opponentName;
            const loserName = challengerWins ? opponentName : challengerName;

            const winner = await initUser(sock, db, winnerJid);
            winner.wallet += 500;
            writeEco(db);

            await sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ ⚔️ ≫─━─━─━╮\n` +
                `│   *BATTLE RESULT!*\n` +
                `╰━─━─━─≪ ⚔️ ≫─━─━─━╯\n\n` +
                `⚡ ${winnerName}'s ${winnerCard.name} (Lv.${winnerCard.level || 1}) defeats ${loserName}'s ${loserCard.name} (Lv.${loserCard.level || 1})\n\n` +
                `🏆 *Winner:* ${winnerName} +500 💵\n\n` +
                `📊 *Power:* ${challengerPower} vs ${opponentPower}`,
                mentions: [winnerJid, loserJid]
            });
            return;
        }

        if (command === 'deny') {
            const key = `${from}_${senderJid}`;
            const challenge = global.pendingBattles.get(key);

            if (!challenge) {
                return sock.sendMessage(from, { text: '❌ You have no pending battle challenge.' });
            }

            global.pendingBattles.delete(key);
            const challengerName = getDisplayName(db, challenge.challengerJid, 'User');
            return sock.sendMessage(from, {
                text: `🚫 *Challenge denied.* ${challengerName}'s challenge was rejected.`,
                mentions: [challenge.challengerJid]
            });
        }
    }
};
