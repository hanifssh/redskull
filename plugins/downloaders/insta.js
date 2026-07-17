const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

const TEMP_DIR = "./temp";

const SITES = [
  {
    name: "fastdl.app",
    url: "https://fastdl.app/en3",
    inputSelectors: ['input[type="text"]', 'input[name="url"]'],
    submitSelectors: ['button[type="submit"]', "button"],
    resultSelectors: ["a.download-btn", "a[download]", 'a[href*=".mp4"]'],
    wait: 5000,
  },
  {
    name: "snapinst.to",
    url: "https://snapinst.to/",
    inputSelectors: ['input[type="text"]', 'input[name="url"]'],
    submitSelectors: ['button[type="submit"]', "button"],
    resultSelectors: ["a.download-link", "a[download]", 'a[href*=".mp4"]'],
    wait: 5000,
  },
  {
    name: "savefrom.net",
    url: "https://en1.savefrom.net/14xK/download-from-instagram",
    inputSelectors: ['input[type="text"]', "input#sf_url"],
    submitSelectors: ['button[type="submit"]', "button"],
    resultSelectors: ["a.download-link", "a[download]", 'a[href*=".mp4"]'],
    wait: 5000,
  },
  {
    name: "sssinstagram.com",
    url: "https://sssinstagram.com/reels-downloader",
    inputSelectors: ['input[type="text"]', 'input[name="url"]'],
    submitSelectors: ['button[type="submit"]', "button"],
    resultSelectors: ["a.download-link", "a[download]", 'a[href*=".mp4"]'],
    wait: 5000,
  },
  {
    name: "fastvidl.com",
    url: "https://fastvidl.com/instagram-video-downloader-free",
    inputSelectors: ['input[type="text"]', 'input[name="url"]'],
    submitSelectors: ['button[type="submit"]', "button"],
    resultSelectors: ["a.download-btn", "a[download]", 'a[href*=".mp4"]'],
    wait: 5000,
  },
];

module.exports = {
  name: "insta",
  description: "Download Instagram videos",
  category: "Download",
  execute: async (sock, from, msg, args) => {
    const url = args && args.length > 0 ? args[0] : "";
    if (!url || !url.includes("instagram.com")) {
      await sock.sendMessage(from, {
        text: `📸 *Instagram Downloader*\n\nUsage: .insta <link>`,
      });
      return;
    }

    await sock.sendMessage(from, {
      text: "📥 Downloading Instagram content… ⏳",
    });

    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });
      const page = await context.newPage();

      let mediaUrls = [];

      for (const site of SITES) {
        try {
          console.log(`[insta] Trying ${site.name}...`);
          await page.goto(site.url, {
            waitUntil: "networkidle",
            timeout: 20000,
          });

          for (const sel of site.inputSelectors) {
            const input = await page.$(sel);
            if (input) {
              await input.click({ clickCount: 3 });
              await input.type(url, { delay: 30 });
              break;
            }
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
            const links = await page.$$eval(sel, (els) =>
              els.map((e) => e.href).filter((h) => h),
            );
            if (links.length > 0) {
              mediaUrls = links;
              break;
            }
          }

          if (mediaUrls.length > 0) {
            console.log(`[insta] Success with ${site.name}`);
            break;
          }
        } catch (e) {
          console.log(`[insta] ${site.name} failed:`, e.message);
        }
      }

      await browser.close();

      if (mediaUrls.length === 0) {
        return sock.sendMessage(from, {
          text: "❌ Could not extract download link. Post may be private or all sites down.",
        });
      }

      await fs.mkdir(TEMP_DIR, { recursive: true });
      for (const mediaUrl of mediaUrls) {
        try {
          const res = await axios.get(mediaUrl, {
            responseType: "arraybuffer",
            timeout: 30000,
          });
          const buffer = Buffer.from(res.data);
          const isVideo = mediaUrl.includes(".mp4");
          const filePath = path.join(
            TEMP_DIR,
            `insta_${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
          );
          await fs.writeFile(filePath, buffer);
          if (isVideo) {
            await sock.sendMessage(from, {
              video: buffer,
              caption: "✅ Downloaded",
            });
          } else {
            await sock.sendMessage(from, {
              image: buffer,
              caption: "✅ Downloaded",
            });
          }
          await fs.unlink(filePath).catch(() => {});
        } catch (dlErr) {
          console.error(`[insta] download error:`, dlErr.message);
        }
      }
    } catch (err) {
      console.error("[insta] browser error:", err);
      if (browser) await browser.close().catch(() => {});
      await sock.sendMessage(from, {
        text: "❌ Failed to download. Try again later.",
      });
    }
  },
};
