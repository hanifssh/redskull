# RedSkull WhatsApp Bot

<p align="center">
  <img src="assets/logo.jpeg" width="200" alt="RedSkull Logo">
</p>

<p align="center">
  A powerful, multi-feature WhatsApp bot built with Baileys. Economy system, games, reactions, AI, downloads, and more — all in one bot.
</p>

<p align="center">
  <a href="https://github.com/hanifssh/redskull/stargazers"><img src="https://img.shields.io/github/stars/hanifssh/redskull?style=for-the-badge&color=f1c40f" alt="Stars"></a>
  <a href="https://github.com/hanifssh/redskull/network/members"><img src="https://img.shields.io/github/forks/hanifssh/redskull?style=for-the-badge&color=3498db" alt="Forks"></a>
  <a href="https://github.com/hanifssh/redskull/issues"><img src="https://img.shields.io/github/issues/hanifssh/redskull?style=for-the-badge&color=e74c3c" alt="Issues"></a>
</p>

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

## Quick Deploy

<p align="center">
  <a href="#termux-android"><img src="https://img.shields.io/badge/Termux-000000?style=for-the-badge&logo=android&logoColor=white" alt="Termux"></a>
  <a href="#ubuntu--debian"><img src="https://img.shields.io/badge/Ubuntu-E95420?style=for-the-badge&logo=ubuntu&logoColor=white" alt="Ubuntu"></a>
  <a href="#arch-linux"><img src="https://img.shields.io/badge/Arch_Linux-1793D1?style=for-the-badge&logo=arch-linux&logoColor=white" alt="Arch"></a>
  <a href="#heroku"><img src="https://img.shields.io/badge/Heroku-430098?style=for-the-badge&logo=heroku&logoColor=white" alt="Heroku"></a>
  <a href="#render"><img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black" alt="Render"></a>
  <a href="#koyeb"><img src="https://img.shields.io/badge/Koyeb-121212?style=for-the-badge&logo=koyeb&logoColor=white" alt="Koyeb"></a>
  <a href="#docker"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"></a>
</p>

---

### Prerequisites

- Node.js 18+ — https://nodejs.org/
- Git — https://git-scm.com/
- FFmpeg — https://ffmpeg.org/
- yt-dlp — https://github.com/yt-dlp/yt-dlp
- A WhatsApp account (secondary recommended)

---

### Termux (Android)
```bash
termux-wake-lock
pkg update && pkg upgrade -y
pkg install nodejs git ffmpeg python -y
pip install yt-dlp
pkg install chromium -y
git clone https://github.com/hanifssh/redskull.git
cd redskull
npm install
npx playwright install chromium
node index.js```

Scan QR code with WhatsApp. For 24/7 uptime:

npm install -g pm2
pm2 start index.js --name redskull
pm2 save

---

### Ubuntu / Debian

sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs git ffmpeg python3-pip chromium-browser -y
pip3 install yt-dlp
git clone https://github.com/hanifssh/redskull.git
cd redskull
npm install
npx playwright install chromium
node index.js

---

### Arch Linux

sudo pacman -Syu
sudo pacman -S nodejs npm git ffmpeg yt-dlp chromium
git clone https://github.com/hanifssh/redskull.git
cd redskull
npm install
npx playwright install chromium
node index.js

---

### Docker

git clone https://github.com/hanifssh/redskull.git
cd redskull
docker build -t redskull .
docker run -d --name redskull --restart unless-stopped redskull

---

### Heroku

<p align="center">
  <a href="https://heroku.com/deploy?template=https://github.com/hanifssh/redskull">
    <img src="https://www.herokucdn.com/deploy/button.svg" alt="Deploy to Heroku">
  </a>
</p>

1. Click the button above
2. Set config vars: PREFIX, MODE, OWNERS
3. Deploy and connect via QR or pairing

Note: Heroku free tier is discontinued. Paid plan or student credits required.

---

### Render

<p align="center">
  <a href="https://render.com/deploy?repo=https://github.com/hanifssh/redskull">
    <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render">
  </a>
</p>

1. Click Deploy to Render
2. Set environment variables in the dashboard
3. Use Web Service type with start command: node index.js

---

### Koyeb

<p align="center">
  <a href="https://app.koyeb.com/deploy?type=git&repository=github.com/hanifssh/redskull&branch=main&name=redskull">
    <img src="https://www.koyeb.com/static/images/deploy/button.svg" alt="Deploy to Koyeb">
  </a>
</p>

1. Click the button and sign in to Koyeb
2. Configure environment variables
3. Set run command to node index.js
4. Deploy

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PREFIX | . | Command prefix |
| MODE | public | public or private |
| OWNERS | [] | Owner phone numbers |
| SUDOS | [] | Sudo user numbers |

---

## Commands

Run .menu in chat to see all available commands. Categories include:

- AI — GPT, Image generation
- Download — YouTube, Instagram, Facebook, TikTok
- Economy — Wallet, bank, cards, orbs, gambling
- Games — Tic Tac Toe, Chess, Word Guess
- Reactions — 27+ anime GIF reactions
- Group — Tag, kick, promote, antilink
- Tools — QC stickers, define, sticker maker
- Bot — Mode, prefix, deploy, update

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
  Made with ❤️ by <a href="https://github.com/hanifssh">Hanif</a>
</p>>
