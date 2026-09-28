const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

const TEMP_DIR = "./temp";

const SITES = [
    {
        name: "fdown.one",
        url: "https://fdown.one/download",
        inputSelectors: ['input[type="text"]', 'input[name="url"]', 'input[type="url"]'],
        submitSelectors: ['button[type="submit"]', "button"],
        resultSelectors: ['a[href*=".mp4"]', "a.download-btn", "a[download]"],
        wait: 6000,
    },
{
    name: "fdownloader.vn",
    url: "https://fdownloader.vn/en",
    inputSelectors: ['input[type="text"]', 'input[name="url"]', 'input[type="url"]'],
    submitSelectors: ['button[type="submit"]', "button"],
    resultSelectors: ['a[href*=".mp4"]', "a.download-btn", "a[download]"],
    wait: 6000,
},
{
    name: "savefrom.net",
    url: "https://en1.savefrom.net/9-how-to-download-facebook-video-8GJ.html",
    inputSelectors: ['input[type="text"]', "input#sf_url"],
    submitSelectors: ['button[type="submit"]', "button"],
    resultSelectors: ['a[href*=".mp4"]', "a.download-link", "a[download]"],
    wait: 6000,
},
{
    name: "snapsave.app",
    url: "https://snapsave.app/",
    inputSelectors: ['input[type="text"]', 'input[name="url"]'],
    submitSelectors: ['button[type="submit"]', "button"],
    resultSelectors: ['a[href*=".mp4"]', "a.download-btn", "a[download]"],
    wait: 6000,
},
];

module.exports = {
    name: "facebook",
    aliases: ["fb"],
    description: "Download Facebook videos",
    category: "Download",
    execute: async (sock, from, msg, args) => {
        const url = args && args.length > 0 ? args[0] : "";
        if (!url || (!url.includes("facebook.com") && !url.includes("fb.watch"))) {
            await sock.sendMessage(from, {
                text: `📘 *Facebook Downloader*\n\nUsage: .fb <facebook link>`,
            });
            return;
        }

        await sock.sendMessage(from, { text: "📥 Downloading Facebook video… ⏳" });

        let browser;
        try {
            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext({
                userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            });

            let downloadUrl = null;
            let usedSite = "";

            for (const site of SITES) {
                try {
                    const page = await context.newPage();
                    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
                    await page.waitForTimeout(2000);

                    let inputFound = false;
                    for (const sel of site.inputSelectors) {
                        const input = await page.$(sel);
                        if (input) {
                            await input.fill(url);
                            inputFound = true;
                            break;
                        }
                    }

                    if (!inputFound) {
                        await page.close();
                        continue;
                    }

                    for (const sel of site.submitSelectors) {
                        const btn = await page.$(sel);
                        if (btn) {
                            await btn.click();
                            break;
                        }
                    }

                    await page.waitForTimeout(site.wait);

                    for (const sel of site.resultSelectors) {
                        const links = await page.$$(sel);
                        for (const link of links) {
                            const href = await link.getAttribute("href");
                            if (href && (href.includes(".mp4") || href.includes("video"))) {
                                downloadUrl = href.startsWith("http") ? href : new URL(href, site.url).href;
                                break;
                            }
                        }
                        if (downloadUrl) break;
                    }

                    await page.close();

                    if (downloadUrl) {
                        usedSite = site.name;
                        break;
                    }
                } catch (err) {
                    console.error(`[fb] ${site.name} failed:`, err.message);
                }
            }

            await browser.close();
            browser = null;

            if (!downloadUrl) {
                await sock.sendMessage(from, {
                    text: "❌ Could not find a download link. Video may be private.",
                });
                return;
            }

            console.log(`[fb] using ${usedSite}, url: ${downloadUrl}`);

            const response = await axios.get(downloadUrl, {
                responseType: "arraybuffer",
                timeout: 120000,
                maxRedirects: 10,
                headers: {
                    "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            });

            const buffer = Buffer.from(response.data);
            if (buffer.length < 1024) throw new Error("File too small");

            await sock.sendMessage(from, {
                video: buffer,
                mimetype: "video/mp4",
                caption: `✅ Downloaded`,
            });

        } catch (error) {
            if (browser) await browser.close();
            console.error("❌ Facebook error:", error.message);
            await sock.sendMessage(from, {
                text: `❌ Download failed. Try again later.`,
            });
        }
    },
};
