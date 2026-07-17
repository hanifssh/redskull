const TicTacToe = {};

const GAME_TIMEOUT = 10 * 60 * 1000;

module.exports = {
    name: 'tictactoe',
    aliases: ['ttt', 'xo'],
    category: 'Games',
    desc: 'Play Tic Tac Toe.\n.ttt → join/create a game\n.ttt @user → challenge someone\n.ttt del → delete current game',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This game only works in groups!' }, { quoted: msg });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const command = args[0]?.toLowerCase();

        if (command === 'del' || command === 'delete') {
            const waitingKey = `${from}_ttt_waiting`;
            const gameKey = `${from}_ttt`;

            if (TicTacToe[waitingKey]?.playerX === senderJid || TicTacToe[gameKey]?.playerX === senderJid || TicTacToe[gameKey]?.playerO === senderJid) {
                if (TicTacToe[waitingKey]) {
                    clearTimeout(TicTacToe[waitingKey].timeout);
                    delete TicTacToe[waitingKey];
                }
                if (TicTacToe[gameKey]) {
                    clearTimeout(TicTacToe[gameKey].timeout);
                    delete TicTacToe[gameKey];
                }
                return sock.sendMessage(from, { text: '🗑️ Game deleted.' }, { quoted: msg });
            }
            return sock.sendMessage(from, { text: '❌ No active game to delete, or you are not in it.' }, { quoted: msg });
        }

        const gameKey = `${from}_ttt`;
        if (TicTacToe[gameKey]) {
            return sock.sendMessage(from, { text: '❌ A game is already running! Finish it first or use .ttt del.' }, { quoted: msg });
        }

        const waitingKey = `${from}_ttt_waiting`;

        if (TicTacToe[waitingKey]) {
            const waiting = TicTacToe[waitingKey];
            if (waiting.playerX === senderJid) {
                return sock.sendMessage(from, { text: '❌ You are already waiting for an opponent!' }, { quoted: msg });
            }

            clearTimeout(waiting.timeout);
            const playerX = waiting.playerX;
            const playerO = senderJid;
            delete TicTacToe[waitingKey];

            const board = [
                ['1️⃣', '2️⃣', '3️⃣'],
                ['4️⃣', '5️⃣', '6️⃣'],
                ['7️⃣', '8️⃣', '9️⃣']
            ];

            TicTacToe[gameKey] = {
                board,
                playerX,
                playerO,
                currentPlayer: playerX,
                moves: 0,
                timeout: null
            };

            TicTacToe[gameKey].timeout = setTimeout(() => {
                if (TicTacToe[gameKey]) {
                    global.sock.sendMessage(from, { text: '⏰ Game expired! No moves for 10 minutes.' });
                    delete TicTacToe[gameKey];
                }
            }, GAME_TIMEOUT);

            const display = board.map(row => row.join(' ')).join('\n');

            await sock.sendMessage(from, {
                text: `🎮 *TIC TAC TOE*\n\n@${playerX.split('@')[0]} ❌ vs ⭕ @${playerO.split('@')[0]}\n\n${display}\n\n🕹️ *@${playerX.split('@')[0]}'s turn (❌)*\nReply with a number (1-9)`,
                                   mentions: [playerX, playerO]
            });
            return;
        }

        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        if (mentioned && mentioned !== senderJid) {
            TicTacToe[waitingKey] = {
                playerX: senderJid,
                playerO: mentioned,
                timeout: null
            };

            TicTacToe[waitingKey].timeout = setTimeout(() => {
                if (TicTacToe[waitingKey]) {
                    global.sock.sendMessage(from, { text: '⏰ Challenge expired! No one accepted in 10 minutes.' });
                    delete TicTacToe[waitingKey];
                }
            }, GAME_TIMEOUT);

            await sock.sendMessage(from, {
                text: `🎮 *TIC TAC TOE CHALLENGE*\n\n@${senderJid.split('@')[0]} ❌ challenged @${mentioned.split('@')[0]} ⭕\n\nType *.ttt* to accept!\n⏰ Expires in 10 minutes.`,
                                   mentions: [senderJid, mentioned]
            }, { quoted: msg });
        } else {
            TicTacToe[waitingKey] = {
                playerX: senderJid,
                timeout: null
            };

            TicTacToe[waitingKey].timeout = setTimeout(() => {
                if (TicTacToe[waitingKey]) {
                    global.sock.sendMessage(from, { text: '⏰ Challenge expired! No one joined in 10 minutes.' });
                    delete TicTacToe[waitingKey];
                }
            }, GAME_TIMEOUT);

            await sock.sendMessage(from, {
                text: `🎮 *TIC TAC TOE*\n\n@${senderJid.split('@')[0]} is looking for an opponent!\n\nType *.ttt* to join!\n⏰ Expires in 10 minutes.`,
                                   mentions: [senderJid]
            }, { quoted: msg });
        }
    }
};

(function gameListener() {
    if (!global.sock) return setTimeout(gameListener, 500);
    global.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const from = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const choice = parseInt(text.trim());

            if (isNaN(choice) || choice < 1 || choice > 9) continue;

            const gameKey = `${from}_ttt`;
            const game = TicTacToe[gameKey];
            if (!game) continue;

            if (sender !== game.currentPlayer) continue;

            const row = Math.floor((choice - 1) / 3);
            const col = (choice - 1) % 3;

            if (game.board[row][col] === '❌' || game.board[row][col] === '⭕') {
                await global.sock.sendMessage(from, { text: '❌ That spot is taken!' }, { quoted: msg });
                continue;
            }

            clearTimeout(game.timeout);
            game.timeout = setTimeout(() => {
                if (TicTacToe[gameKey]) {
                    global.sock.sendMessage(from, { text: '⏰ Game expired! No moves for 10 minutes.' });
                    delete TicTacToe[gameKey];
                }
            }, GAME_TIMEOUT);

            const symbol = game.currentPlayer === game.playerX ? '❌' : '⭕';
            game.board[row][col] = symbol;
            game.moves++;

            const display = game.board.map(r => r.join(' ')).join('\n');

            if (checkWin(game.board, symbol)) {
                clearTimeout(game.timeout);
                const winner = game.currentPlayer;
                await global.sock.sendMessage(from, {
                    text: `🎮 *TIC TAC TOE*\n\n${display}\n\n🏆 *@${winner.split('@')[0]} WINS!* 🎉`,
                                              mentions: [winner]
                }, { quoted: msg });
                delete TicTacToe[gameKey];
                continue;
            }

            if (game.moves === 9) {
                clearTimeout(game.timeout);
                await global.sock.sendMessage(from, {
                    text: `🎮 *TIC TAC TOE*\n\n${display}\n\n🤝 *DRAW!*`
                }, { quoted: msg });
                delete TicTacToe[gameKey];
                continue;
            }

            game.currentPlayer = game.currentPlayer === game.playerX ? game.playerO : game.playerX;
            const sym = game.currentPlayer === game.playerX ? '❌' : '⭕';

            await global.sock.sendMessage(from, {
                text: `🎮 *TIC TAC TOE*\n\n${display}\n\n🕹️ *@${game.currentPlayer.split('@')[0]}'s turn (${sym})*\nReply with a number (1-9)`,
                                          mentions: [game.playerX, game.playerO]
            }, { quoted: msg });
        }
    });
})();

function checkWin(board, symbol) {
    for (let i = 0; i < 3; i++) {
        if (board[i][0] === symbol && board[i][1] === symbol && board[i][2] === symbol) return true;
        if (board[0][i] === symbol && board[1][i] === symbol && board[2][i] === symbol) return true;
    }
    if (board[0][0] === symbol && board[1][1] === symbol && board[2][2] === symbol) return true;
    if (board[0][2] === symbol && board[1][1] === symbol && board[2][0] === symbol) return true;
    return false;
}

