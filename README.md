# RedSkull WhatsApp Bot

<p align="center">
  <img src="assets/logo.jpeg" width="200" alt="RedSkull Logo">
</p>

<p align="center">
  A powerful, multi-feature WhatsApp bot built with Baileys. Economy system, games, reactions, AI, downloads, and more — all in one bot.
</p>

<p align="center">
  <a href="https://github.com"><img src="https://shields.io" alt="Stars"></a>
  <a href="https://github.com"><img src="https://shields.io" alt="Forks"></a>
  <a href="https://github.com"><img src="https://shields.io" alt="Issues"></a>
</p>

---

## ⚠️ CRITICAL CRASH WARNING: NODE.JS VERSION REQUIREMENT

This bot relies heavily on native graphics engines (`canvas` and `sharp`) to generate gaming boards, cards, quotes, and custom stickers. 

* **Do NOT use bleeding-edge Node.js versions (Node 22, 23, 24+)**. Unstable or experimental Node runtimes cannot resolve prebuilt binary modules for these libraries and will cause silent compilation crashes.
* **YOU MUST RUN NODE.JS 20 (LTS)**. Using a stable version manager ensures your system automatically fetches compatible components out-of-the-box. 

---

## Features

- Economy System — Wallet, bank, orbs, daily rewards, rob, gamble, fish, dig
- Card Collection — Anime & Pokémon card spawning, catching, trading, battles
- Games — Tic Tac Toe, Chess (canvas), Word Guess, Truth or Dare
- Reactions — 27+ anime GIF reactions (kiss, hug, slap, pat, cuddle, etc.)
- Downloads — YouTube (video/audio), Instagram, Facebook, TikTok
- AI — GPT chat, image generation
- Group Management — Tag all, antilink, mute, kick, promote, demote
- Stickers & QC — Quote sticker maker, image to sticker
- Honor Board — Rank players by wealth, cards, and training
- Deploy Guide — Built-in deployment instructions for all platforms

---

## Quick Deploy Platforms

<p align="center">
  <a href="#termux-android"><img src="https://shields.io" alt="Termux"></a>
  <a href="#ubuntu--debian"><img src="https://shields.io" alt="Ubuntu"></a>
  <a href="#arch-linux"><img src="https://shields.io" alt="Arch"></a>
  <a href="#docker"><img src="https://shields.io" alt="Docker"></a>
</p>

---

### Prerequisites

- Node.js 20 (LTS Environment Only)
- Git — https://git-scm.com
- FFmpeg — https://ffmpeg.org
- yt-dlp — https://github.com
- A WhatsApp account (secondary recommended)

---

### Termux (Android)
```bash
termux-wake-lock
pkg update && pkg upgrade -y
pkg install nodejs-lts git ffmpeg python -y
pip install yt-dlp
pkg install chromium -y
git clone https://github.com
cd redskull
npm config set allow-git all
npm install
npx playwright install chromium
npm start
```

#### Scan QR code with WhatsApp. For 24/7 uptime:
```bash
npm install -g pm2
pm2 start index.js --name redskull
pm2 save
```

---

### Ubuntu / Debian
```bash
# 1. Update and install core compilers + required graphical header packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ffmpeg python3-pip chromium-browser build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
pip3 install yt-dlp

# 2. Lock down the environment to Node 20 LTS
curl -fsSL https://nodesource.com | sudo -E bash -
sudo apt install nodejs -y

# 3. Clone repository and bypass git restrictions
git clone https://github.com
cd redskull
npm config set allow-git all
npm config set ignore-scripts false

# 4. Pre-approve lifecycle compilation hooks for modern npm packages
npm install-scripts approve canvas sharp ffmpeg-static protobufjs novaxmd-baileys-v2 @whiskeysockets/baileys 2>/dev/null || true

# 5. Build and launch
npm install
npx playwright install chromium
npm start
```

---

### Arch Linux
```bash
# 1. System upgrade and base graphics engine prerequisites
sudo pacman -Syu
sudo pacman -S --needed base-devel cairo pango libjpeg-turbo giflib librsvg libvips git ffmpeg yt-dlp chromium

# 2. Setup Fast Node Manager (FNM) to isolate the Node 20 runtime 
# (This prevents bleeding-edge Arch system Node updates from breaking things)
sudo pacman -S fnm
eval "\$(fnm env)"
fnm install 20
fnm use 20

# 3. Clone and unblock configuration constraints
git clone https://github.com
cd redskull
npm config set allow-git all
npm config set ignore-scripts false

# 4. Pre-approve packages matching strict modern npm script-execution policies
npm install-scripts approve canvas sharp ffmpeg-static protobufjs novaxmd-baileys-v2 @whiskeysockets/baileys 2>/dev/null || true

# 5. Bypass global linking structures and build
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install
npx playwright install chromium

# 6. Execute bot application
npm start
```

---

### Docker
```bash
git clone https://github.com
cd redskull
docker build -t redskull .
docker run -d --name redskull --restart unless-stopped redskull
```

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

---

## Disclaimer

This bot is for educational purposes. Use responsibly. The developer is not responsible for any misuse or account bans.

---

## License

MIT

---

<p align="center">
  Made with 🤍 by <a href="https://github.com">Hanif</a>
</p>
