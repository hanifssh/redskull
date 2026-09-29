const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);
const gplay = require('@mradex77/google-play-scraper');
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = "./temp";
const MAX_SIZE = 200 * 1024 * 1024;

function isApkBuffer(buffer) {
    if (!buffer || buffer.length < 1024) return false;
    return buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
}

module.exports = {
    name: "apk",
    aliases: ["apkdl","app"],
    category: "Download",
    desc: "Download APKs by app name.\n.apk whatsapp\n.apk com.whatsapp",

    execute: async (sock, from, msg, args, perms) => {
        const query = args.join(" ").trim();
        if (!query) {
            return sock.sendMessage(from, {
                text: `📦 *APK Downloader*\n\nUsage: \`.apk <app name>\`\nExample: \`.apk whatsapp\``
            }, { quoted: msg });
        }

        let packageName = query;
        let appTitle = query;

        try {
            if (!query.includes(".")) {
                const results = await gplay.search({ term: query, num: 1 });
                if (!results || results.length === 0) {
                    return sock.sendMessage(from, { text: `❌ App not found.` }, { quoted: msg });
                }
                packageName = results[0].appId;
                appTitle = results[0].title;
            }

            let sizeBytes = 0;
            try {
                const details = await gplay.app({ appId: packageName });
                if (details && details.size) sizeBytes = details.size;
                if (details && details.title) appTitle = details.title;
            } catch {}

            if (sizeBytes > MAX_SIZE) {
                return sock.sendMessage(from, {
                    text: `❌ *App too large*\n\n*${appTitle}* is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB.\nMax allowed: 200 MB.`
                }, { quoted: msg });
            }

            const sizeText = sizeBytes > 0 ? `${(sizeBytes / 1024 / 1024).toFixed(1)} MB` : 'unknown';

            const sentMsg = await sock.sendMessage(from, {
                text:
                `╭━─━─━─≪ ✠ ≫─━─━─━╮\n` +
                `│  *APK DOWNLOADER*\n` +
                `╰━─━─━─≪ ✠ ≫─━─━─━╯\n` +
                `│\n` +
                `│ ✗ *App:* ${appTitle}\n` +
                `│ ✗ *Package:* ${packageName}\n` +
                `│ ✗ *Size:* ${sizeText}\n` +
                `│ ✗ *Status:* Downloading...\n` +
                `│\n` +
                `│ _Downloading apks may take more time._\n` +
                `│\n╰━━─━─━─≪ ✠ ≫─━─━─━╯`
            }, { quoted: msg });

            if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

            let browser;
            let filePath = null;

            try {
                browser = await chromium.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-extensions',
                        '--disable-background-networking',
                        '--disable-sync',
                        '--disable-translate',
                        '--no-first-run',
                        '--no-default-browser-check',
                        '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints'
                    ]
                });

                const context = await browser.newContext({
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                         acceptDownloads: true,
                                                         bypassCSP: true,
                                                         viewport: { width: 1280, height: 720 }
                });

                const page = await context.newPage();

                await page.route('**/*', (route) => {
                    const type = route.request().resourceType();
                    if (['font', 'stylesheet', 'image', 'media'].includes(type)) {
                        route.abort();
                    } else {
                        route.continue();
                    }
                });

                await page.goto("https://www.apk-extractor.com/en", { waitUntil: "domcontentloaded", timeout: 30000 });

                const input = await page.waitForSelector("input", { timeout: 10000 });
                await input.fill(packageName);

                const generateBtn = await page.waitForSelector('button:has-text("Generate Download Link")', { timeout: 10000 });
                await generateBtn.click();

                const downloadBtn = await page.waitForSelector('button:has-text("Download Now")', { timeout: 60000 });

                filePath = path.join(TEMP_DIR, `${packageName}-latest.apk`);
                const downloadPromise = page.waitForEvent("download", { timeout: 300000 });

                await downloadBtn.click();

                const download = await downloadPromise;
                await download.saveAs(filePath);

                await browser.close();
                browser = null;
            } catch (err) {
                if (browser) await browser.close();
                console.error("[apk] browser error:", err.message);
                return sock.sendMessage(from, { text: `❌ Download failed: ${err.message}` }, { quoted: msg });
            }

            const buffer = fs.readFileSync(filePath);

            if (!isApkBuffer(buffer)) {
                try { fs.unlinkSync(filePath); } catch {}
                return sock.sendMessage(from, { text: `❌ Downloaded file is not a valid APK.` }, { quoted: msg });
            }

            if (buffer.length > MAX_SIZE) {
                try { fs.unlinkSync(filePath); } catch {}
                return sock.sendMessage(from, {
                    text: `❌ *File too large*\n\nDownloaded APK is ${(buffer.length / 1024 / 1024).toFixed(1)} MB.\nMax allowed: 200 MB.`
                }, { quoted: msg });
            }

            await sock.sendMessage(from, {
                document: buffer,
                mimetype: "application/vnd.android.package-archive",
                fileName: `${appTitle}.apk`,
                caption: `📦 *${appTitle}*\n\n📱 \`${packageName}\`\n📊 ${(buffer.length / 1024 / 1024).toFixed(1)} MB`
            }, { quoted: msg });

            try { fs.unlinkSync(filePath); } catch {}

        } catch (err) {
            console.error("[apk] error:", err.message);
            await sock.sendMessage(from, { text: `❌ Download failed: ${err.message}` }, { quoted: msg });
        }
    }
};
