const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const Chess = {};
const GAME_TIMEOUT = 15 * 60 * 1000;
const TEMP_DIR = path.join(__dirname, '../../temp');

const PIECES = {
    r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟',
    R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔', P: '♙'
};

function createBoard() {
    return [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
}

async function drawBoard(game) {
    const sq = 56;
    const boardSize = sq * 8;
    const sidebar = 100;
    const margin = 28;
    const width = boardSize + sidebar + margin * 2;
    const height = boardSize + margin * 2;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(margin - 3, margin - 3, boardSize + 6, boardSize + 6);

    const light = '#f0d9b5';
    const dark = '#b58863';
    const lastMoveColor = 'rgba(255, 255, 0, 0.25)';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const x = margin + c * sq;
            const y = margin + r * sq;
            ctx.fillStyle = (r + c) % 2 === 0 ? light : dark;
            ctx.fillRect(x, y, sq, sq);

            if (game.lastMove) {
                const [fr, fc, tr, tc] = game.lastMove;
                if ((r === fr && c === fc) || (r === tr && c === tc)) {
                    ctx.fillStyle = lastMoveColor;
                    ctx.fillRect(x, y, sq, sq);
                }
            }

            const piece = game.board[r][c];
            if (piece !== '.') {
                ctx.font = `${sq * 0.7}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillText(PIECES[piece], x + sq / 2 + 1, y + sq / 2 + 1);
                ctx.fillStyle = piece === piece.toUpperCase() ? '#ffffff' : '#1a1a1a';
                ctx.fillText(PIECES[piece], x + sq / 2, y + sq / 2);
            }
        }
    }

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? light : dark;
        ctx.fillText(files[i], margin + i * sq + sq / 2, margin + boardSize + 14);
        ctx.fillStyle = (7 - i) % 2 === 0 ? light : dark;
        ctx.fillText(String(8 - i), margin - 14, margin + i * sq + sq / 2);
    }

    const sx = margin + boardSize + 16;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Captured', sx, margin);
    let wy = margin + 20;
    ctx.font = '20px serif';
    for (const p of (game.capturedByWhite || [])) {
        ctx.fillStyle = '#000000';
        ctx.fillText(PIECES[p], sx, wy);
        wy += 24;
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Captured', sx, margin + boardSize / 2);
    let by = margin + boardSize / 2 + 20;
    ctx.font = '20px serif';
    for (const p of (game.capturedByBlack || [])) {
        ctx.fillStyle = '#ffffff';
        ctx.fillText(PIECES[p], sx, by);
        by += 24;
    }

    return canvas.toBuffer('image/png');
}

function parseMove(str) {
    const match = str.toLowerCase().match(/^([a-h])([1-8])\s*([a-h])([1-8])$/);
    if (!match) return null;
    return {
        fromCol: match[1].charCodeAt(0) - 97,
        fromRow: 8 - parseInt(match[2]),
        toCol: match[3].charCodeAt(0) - 97,
        toRow: 8 - parseInt(match[4])
    };
}

function isValidPawnMove(board, fromR, fromC, toR, toC, isWhite) {
    const direction = isWhite ? -1 : 1;
    const startRow = isWhite ? 6 : 1;
    const target = board[toR][toC];
    if (fromC === toC && target === '.') {
        if (toR === fromR + direction) return true;
        if (fromR === startRow && toR === fromR + 2 * direction && board[fromR + direction][fromC] === '.') return true;
    }
    if (Math.abs(fromC - toC) === 1 && toR === fromR + direction && target !== '.' && isWhite !== (target === target.toUpperCase())) {
        return true;
    }
    return false;
}

function isPathClear(board, fromR, fromC, toR, toC) {
    const dr = Math.sign(toR - fromR);
    const dc = Math.sign(toC - fromC);
    let r = fromR + dr, c = fromC + dc;
    while (r !== toR || c !== toC) {
        if (board[r][c] !== '.') return false;
        r += dr;
        c += dc;
    }
    return true;
}

function isValidMove(board, fromR, fromC, toR, toC, isWhite) {
    if (fromR < 0 || fromR > 7 || fromC < 0 || fromC > 7 || toR < 0 || toR > 7 || toC < 0 || toC > 7) return false;
    if (fromR === toR && fromC === toC) return false;
    const piece = board[fromR][fromC];
    if (piece === '.') return false;
    if ((piece === piece.toUpperCase()) !== isWhite) return false;
    const target = board[toR][toC];
    if (target !== '.' && (target === target.toUpperCase()) === isWhite) return false;

    const type = piece.toLowerCase();
    const dr = toR - fromR;
    const dc = toC - fromC;

    switch (type) {
        case 'p': return isValidPawnMove(board, fromR, fromC, toR, toC, isWhite);
        case 'r': return (dr === 0 || dc === 0) && isPathClear(board, fromR, fromC, toR, toC);
        case 'n': return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
        case 'b': return Math.abs(dr) === Math.abs(dc) && isPathClear(board, fromR, fromC, toR, toC);
        case 'q': return (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) && isPathClear(board, fromR, fromC, toR, toC);
        case 'k': return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
        default: return false;
    }
}

function findKing(board, isWhite) {
    const king = isWhite ? 'K' : 'k';
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c] === king) return { r, c };
            return null;
}

function isInCheck(board, isWhite) {
    const king = findKing(board, isWhite);
    if (!king) return false;
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c] !== '.' && (board[r][c] === board[r][c].toUpperCase()) !== isWhite)
                if (isValidMove(board, r, c, king.r, king.c, !isWhite)) return true;
                return false;
}

function hasLegalMoves(board, isWhite) {
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c] !== '.' && (board[r][c] === board[r][c].toUpperCase()) === isWhite)
                for (let tr = 0; tr < 8; tr++)
                    for (let tc = 0; tc < 8; tc++)
                        if (isValidMove(board, r, c, tr, tc, isWhite)) {
                            const temp = board.map(row => [...row]);
                            temp[tr][tc] = temp[r][c];
                            temp[r][c] = '.';
                            if (!isInCheck(temp, isWhite)) return true;
                        }
                        return false;
}

module.exports = {
    name: 'chess',
    aliases: [],
    category: 'Games',
    desc: 'Play chess with canvas board.\n.chess → wait for opponent\n.chess @user → challenge\nMove: e2 e4',

    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This game only works in groups!' }, { quoted: msg });

        const senderJid = msg.key.participant || msg.key.remoteJid;
        const command = args[0]?.toLowerCase();

        if (command === 'del' || command === 'delete') {
            const gameKey = `${from}_chess`;
            const waitingKey = `${from}_chess_waiting`;
            if (Chess[waitingKey]?.white === senderJid) {
                clearTimeout(Chess[waitingKey].timeout);
                delete Chess[waitingKey];
                return sock.sendMessage(from, { text: '🗑️ Challenge cancelled.' }, { quoted: msg });
            }
            if (Chess[gameKey] && (Chess[gameKey].white === senderJid || Chess[gameKey].black === senderJid)) {
                clearTimeout(Chess[gameKey].timeout);
                delete Chess[gameKey];
                return sock.sendMessage(from, { text: '🗑️ Game deleted.' }, { quoted: msg });
            }
            return sock.sendMessage(from, { text: '❌ No active game to delete.' }, { quoted: msg });
        }

        const gameKey = `${from}_chess`;
        if (Chess[gameKey]) {
            return sock.sendMessage(from, { text: '❌ A game is already running!' }, { quoted: msg });
        }

        const waitingKey = `${from}_chess_waiting`;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        if (Chess[waitingKey]) {
            const waiting = Chess[waitingKey];
            if (waiting.white === senderJid) {
                return sock.sendMessage(from, { text: '❌ You are already waiting!' }, { quoted: msg });
            }
            clearTimeout(waiting.timeout);
            const playerWhite = waiting.white;
            const playerBlack = senderJid;
            delete Chess[waitingKey];

            const board = createBoard();
            Chess[gameKey] = {
                board,
                white: playerWhite,
                black: playerBlack,
                currentTurn: 'white',
                lastMove: null,
                capturedByWhite: [],
                capturedByBlack: [],
                timeout: null
            };

            Chess[gameKey].timeout = setTimeout(() => {
                if (Chess[gameKey]) {
                    global.sock.sendMessage(from, { text: '⏰ Game expired! 15 min no moves.' });
                    delete Chess[gameKey];
                }
            }, GAME_TIMEOUT);

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
            const img = await drawBoard(Chess[gameKey]);
            const tmpPath = path.join(TEMP_DIR, `chess_${Date.now()}.png`);
            fs.writeFileSync(tmpPath, img);

            await sock.sendMessage(from, {
                image: fs.readFileSync(tmpPath),
                                   caption: `♟️ *CHESS*\n@${playerWhite.split('@')[0]} ⚪ vs ⚫ @${playerBlack.split('@')[0]}\n🕹️ *@${playerWhite.split('@')[0]}'s turn (White)*\nMove: \`e2 e4\``,
                                   mentions: [playerWhite, playerBlack]
            });
            fs.unlinkSync(tmpPath);
            return;
        }

        if (mentioned && mentioned !== senderJid) {
            Chess[waitingKey] = {
                white: senderJid,
                opponent: mentioned,
                timeout: null
            };
            Chess[waitingKey].timeout = setTimeout(() => {
                if (Chess[waitingKey]) {
                    global.sock.sendMessage(from, { text: '⏰ Challenge expired!' });
                    delete Chess[waitingKey];
                }
            }, GAME_TIMEOUT);

            await sock.sendMessage(from, {
                text: `♟️ *CHESS CHALLENGE*\n@${senderJid.split('@')[0]} wants to play!\nOpponent: @${mentioned.split('@')[0]}\nType *.chess* to accept!\n⏰ Expires in 15 min.`,
                                   mentions: [senderJid, mentioned]
            }, { quoted: msg });
        } else {
            Chess[waitingKey] = {
                white: senderJid,
                timeout: null
            };
            Chess[waitingKey].timeout = setTimeout(() => {
                if (Chess[waitingKey]) {
                    global.sock.sendMessage(from, { text: '⏰ Challenge expired! No one joined.' });
                    delete Chess[waitingKey];
                }
            }, GAME_TIMEOUT);

            await sock.sendMessage(from, {
                text: `♟️ *CHESS*\n@${senderJid.split('@')[0]} is looking for an opponent!\nType *.chess* to join!\n⏰ Expires in 15 min.`,
                                   mentions: [senderJid]
            }, { quoted: msg });
        }
    }
};

(function chessListener() {
    if (!global.sock) return setTimeout(chessListener, 500);
    global.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const from = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();

            const gameKey = `${from}_chess`;
            const game = Chess[gameKey];
            if (!game) continue;

            if (text.startsWith('.chess del') || text.startsWith('.chess quit')) {
                if (game.white === sender || game.black === sender) {
                    clearTimeout(game.timeout);
                    delete Chess[gameKey];
                    await global.sock.sendMessage(from, { text: '🗑️ Game ended.' }, { quoted: msg });
                }
                continue;
            }

            if (text.startsWith('.') || text.startsWith('#') || text.startsWith('!')) continue;

            const move = parseMove(text);
            if (!move) continue;

            const isWhiteTurn = game.currentTurn === 'white';
            const currentPlayer = isWhiteTurn ? game.white : game.black;
            if (sender !== currentPlayer) continue;

            const { fromCol, fromRow, toCol, toRow } = move;

            if (!isValidMove(game.board, fromRow, fromCol, toRow, toCol, isWhiteTurn)) continue;

            const tempBoard = game.board.map(row => [...row]);
            const captured = tempBoard[toRow][toCol];
            tempBoard[toRow][toCol] = tempBoard[fromRow][fromCol];
            tempBoard[fromRow][fromCol] = '.';

            if (isInCheck(tempBoard, isWhiteTurn)) {
                await global.sock.sendMessage(from, { text: '❌ King would be in check!' }, { quoted: msg });
                continue;
            }

            if (captured !== '.') {
                if (isWhiteTurn) game.capturedByWhite.push(captured);
                else game.capturedByBlack.push(captured);
            }

            game.board = tempBoard;
            game.lastMove = [fromRow, fromCol, toRow, toCol];
            game.currentTurn = isWhiteTurn ? 'black' : 'white';

            clearTimeout(game.timeout);
            game.timeout = setTimeout(() => {
                if (Chess[gameKey]) {
                    global.sock.sendMessage(from, { text: '⏰ Game expired! 15 min no moves.' });
                    delete Chess[gameKey];
                }
            }, GAME_TIMEOUT);

            const nextIsWhite = game.currentTurn === 'white';
            const nextPlayer = nextIsWhite ? game.white : game.black;
            const checkMsg = isInCheck(game.board, nextIsWhite) ? '⚠️ CHECK! ' : '';

            if (!hasLegalMoves(game.board, nextIsWhite)) {
                const winner = isWhiteTurn ? game.white : game.black;
                const reason = isInCheck(game.board, nextIsWhite) ? 'CHECKMATE' : 'STALEMATE';
                if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
                const img = await drawBoard(game);
                const tmpPath = path.join(TEMP_DIR, `chess_${Date.now()}.png`);
                fs.writeFileSync(tmpPath, img);

                await global.sock.sendMessage(from, {
                    image: fs.readFileSync(tmpPath),
                                              caption: `♟️ *${reason}!*\n🏆 @${winner.split('@')[0]} WINS! 🎉`,
                                              mentions: [winner]
                }, { quoted: msg });
                fs.unlinkSync(tmpPath);
                delete Chess[gameKey];
                continue;
            }

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
            const img = await drawBoard(game);
            const tmpPath = path.join(TEMP_DIR, `chess_${Date.now()}.png`);
            fs.writeFileSync(tmpPath, img);

            await global.sock.sendMessage(from, {
                image: fs.readFileSync(tmpPath),
                                          caption: `♟️ *CHESS*\n${checkMsg}🕹️ *@${nextPlayer.split('@')[0]}'s turn (${nextIsWhite ? 'White' : 'Black'})*\nMove: \`e2 e4\``,
                                          mentions: [game.white, game.black]
            }, { quoted: msg });
            fs.unlinkSync(tmpPath);
        }
    });
})();
