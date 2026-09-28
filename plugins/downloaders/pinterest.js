const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);
const axios = require("axios");

module.exports = {
    name: "pinterest",
    aliases: ["img", "pin"],
    category: "Download",
    desc: "Search Pinterest for images.\n.pinterest <query>\n.pinterest 10 <query>",

    execute: async (sock, from, msg, args, perms) => {
        if (!args || args.length === 0) {
            return sock.sendMessage(from, {
                text: `📌 *Pinterest Image Search*\n\nUsage:\n\`.pinterest <query>\` (3 images)\n\`.pinterest 10 <query>\` (10 images)`
            }, { quoted: msg });
        }

        let count = 3;
        let query = args.join(" ").trim();

        const firstArg = parseInt(args[0]);
        if (!isNaN(firstArg) && firstArg > 0) {
            count = Math.min(firstArg, 15);
            query = args.slice(1).join(" ").trim();
        }

        if (!query) {
            return sock.sendMessage(from, { text: "❌ Provide a search query." }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: `🔍 Searching *${query}*...` }, { quoted: msg });

        let browser;
        try {
            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            });
            const page = await context.newPage();

            await page.route('**/*', (route) => {
                const type = route.request().resourceType();
                if (['font', 'stylesheet', 'media'].includes(type)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
            await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
            await page.waitForTimeout(2000);

            const imageUrls = new Set();
            let scrolls = 0;
            const maxScrolls = Math.ceil(count / 8) + 3;

            while (imageUrls.size < count * 2 && scrolls < maxScrolls) {
                const newUrls = await page.evaluate(() => {
                    const urls = [];
                    const imgs = document.querySelectorAll('img[src*="pinimg.com"]');
                    imgs.forEach(img => {
                        const src = img.src;
                        if (src && !src.includes('75x75') && !src.includes('30x30') && !src.includes('236x')) {
                            urls.push(src.replace(/\/\d+x\d*\//, '/originals/'));
                        }
                    });
                    return urls;
                });

                newUrls.forEach(url => imageUrls.add(url));

                if (imageUrls.size >= count) break;

                await page.evaluate(() => window.scrollBy(0, 2000));
                await page.waitForTimeout(1200);
                scrolls++;
            }

            await browser.close();
            browser = null;

            const finalUrls = Array.from(imageUrls).slice(0, count);

            if (finalUrls.length === 0) {
                return sock.sendMessage(from, { text: `❌ No images found.` }, { quoted: msg });
            }

            const downloads = await Promise.allSettled(
                finalUrls.map(async (url, i) => {
                    try {
                        const imgRes = await axios.get(url, {
                            responseType: "arraybuffer",
                            timeout: 15000,
                            headers: { "User-Agent": "Mozilla/5.0" }
                        });
                        const buffer = Buffer.from(imgRes.data);
                        if (buffer.length < 5120) throw new Error('too small');
                        return { buffer, index: i };
                    } catch (e) {
                        return null;
                    }
                })
            );

            const validImages = downloads
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value)
            .sort((a, b) => a.index - b.index);

            await Promise.all(
                validImages.map(({ buffer, index }) =>
                sock.sendMessage(from, {
                    image: buffer,
                    caption: `📌 *${query}*`
                }, { quoted: msg }).catch(() => {})
                )
            );

        } catch (err) {
            if (browser) await browser.close();
            console.error("[pinterest] error:", err.message);
            await sock.sendMessage(from, { text: "❌ Search failed. Try again." }, { quoted: msg });
        }
    }
};
