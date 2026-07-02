const fs   = require('fs');
const path = require('path');

const ECO_PATH   = path.join(__dirname, '../../database/economy.json');
const SPAWN_PATH = path.join(__dirname, '../../database/spawner.json');

const dbDir = path.dirname(ECO_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(ECO_PATH))   fs.writeFileSync(ECO_PATH,   JSON.stringify({ users: {} }, null, 2));
if (!fs.existsSync(SPAWN_PATH)) fs.writeFileSync(SPAWN_PATH, JSON.stringify({}, null, 2));

function readEco() {
    try { return JSON.parse(fs.readFileSync(ECO_PATH, 'utf-8')); }
    catch { return { users: {} }; }
}
function writeEco(data) {
    fs.writeFileSync(ECO_PATH, JSON.stringify(data, null, 2));
}

function getSpawns() {
    try { return JSON.parse(fs.readFileSync(SPAWN_PATH, 'utf-8')); }
    catch { return {}; }
}
function saveSpawns(data) {
    fs.writeFileSync(SPAWN_PATH, JSON.stringify(data, null, 2));
}

function initUser(db, jid, name = 'User') {
    if (!db.users[jid]) {
        db.users[jid] = {
            name,
            wallet:    500,
            bank:      0,
            orbs:      0,
            deck:      [],
            pokemonDeck: [],
            lastDaily: 0,
            lastDig:   0,
            lastFish:  0,
        };
    }
    const u = db.users[jid];
    if (!u.deck)          u.deck      = [];
    if (!u.pokemonDeck)   u.pokemonDeck = [];
    if (!u.orbs)          u.orbs      = 0;
    if (!u.lastDig)       u.lastDig   = 0;
    if (!u.lastFish)      u.lastFish  = 0;
    if (!u.lastDaily)     u.lastDaily = 0;
    if (!u.lastHunt) u.lastHunt = 0;
    return u;
}

const activeSpawns = new Map();

module.exports = { readEco, writeEco, getSpawns, saveSpawns, initUser, activeSpawns };
