const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);
const axios = require("axios");

async function searchViaApi(query, count) {
    const args = {
        options: {
            query: query,
            scope: "pins",
            bookmarks: [],
            page_size: count * 3
        },
        context: {}
    };

    const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?data=${encodeURIComponent(JSON.stringify(args))}`;

    const res = await axios.get(url, {
        timeout: 20000,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                "Accept": "application/json, text/plain, */*",
                                "Accept-Language": "en-US,en;q=0.9",
                                "X-Requested-With": "XMLHttpRequest",
                                "X-Pinterest-AppState": "active",
                                "X-Pinterest-Source-Url": "/ideas/",
                                "X-Pinterest-PWS-Handler": "www/ideas.js"
        }
    });

    const results = res.data?.resource_response?.data?.results || [];
    const urls = [];
    for (const pin of results) {
        const img = pin?.images?.orig?.url || pin?.images?.["736x"]?.url || pin?.images?.["564x"]?.url;
        if (img) urls.push(img.replace(/\/\d+x\d*\//, "/originals/"));
    }
    return urls;
}

async function searchViaBrowser(query, count) {
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                                 viewport: { width: 1440, height: 900 }
        });
        const page = await context.newPage();

        await page.route("**/*", (route) => {
            const type = route.request().resourceType();
            if (["font", "stylesheet", "media"].includes(type)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35000 });
        await page.waitForTimeout(4000);

        const imageUrls = new Set();
        let scrolls = 0;
        const maxScrolls = Math.ceil(count / 5) + 6;

        while (imageUrls.size < count && scrolls < maxScrolls) {
            const newUrls = await page.evaluate(() => {
                const urls = [];
                const imgs = document.querySelectorAll("img");
                imgs.forEach(img => {
                    const src = img.src || img.getAttribute("data-src") || "";
                    if (src.includes("pinimg.com") && !src.includes("75x75") && !src.includes("30x30") && !src.includes("236x")) {
                        urls.push(src.replace(/\/\d+x\d*\//, "/originals/"));
                    }
                });
                return urls;
            });

            newUrls.forEach(u => imageUrls.add(u));
            if (imageUrls.size >= count) break;

            await page.evaluate(() => window.scrollBy(0, 1500));
            await page.waitForTimeout(2000);
            scrolls++;
        }

        await browser.close();
        browser = null;
        return Array.from(imageUrls);
    } catch (err) {
        if (browser) await browser.close();
        throw err;
    }
}

module.exports = {
    name: "pinterest",
    aliases: ["img", "pin"],
    category: "Download",
    desc: "Search Pinterest for images.\n.pinterest <query>\n.pinterest 10 <query>",

    execute: async (sock, from, msg, args, perms) => {
        if (!args || args.length === 0) {
            return sock.sendMessage(from, {
                text: `📌 *Pinterest Search*\n\nUsage:\n\`.pinterest <query>\` (3 images)\n\`.pinterest 10 <query>\` (10 images)`
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

        let urls = [];

        try {
            urls = await searchViaApi(query, count);
            console.log(`[pinterest] API returned ${urls.length} images`);
        } catch (err) {
            console.log(`[pinterest] API failed: ${err.message}, falling back to browser`);
        }

        if (urls.length < count) {
            try {
                const browserUrls = await searchViaBrowser(query, count);
                console.log(`[pinterest] browser returned ${browserUrls.length} images`);
                for (const u of browserUrls) {
                    if (!urls.includes(u)) urls.push(u);
                    if (urls.length >= count) break;
                }
            } catch (err) {
                console.log(`[pinterest] browser failed: ${err.message}`);
            }
        }

        urls = urls.slice(0, count);

        if (urls.length === 0) {
            return sock.sendMessage(from, { text: `❌ No images found for *${query}*. Try a different keyword.` }, { quoted: msg });
        }

        const downloads = await Promise.allSettled(
            urls.map(async (url, i) => {
                try {
                    const imgRes = await axios.get(url, {
                        responseType: "arraybuffer",
                        timeout: 15000,
                        headers: { "User-Agent": "Mozilla/5.0" }
                    });
                    const buffer = Buffer.from(imgRes.data);
                    if (buffer.length < 5120) throw new Error("too small");
                    return { buffer, index: i };
                } catch {
                    return null;
                }
            })
        );

        const validImages = downloads
        .filter(r => r.status === "fulfilled" && r.value)
        .map(r => r.value)
        .sort((a, b) => a.index - b.index);

        if (validImages.length === 0) {
            return sock.sendMessage(from, { text: `❌ Found URLs but couldn't download images.` }, { quoted: msg });
        }

        await Promise.all(
            validImages.map(({ buffer }) =>
            sock.sendMessage(from, {
                image: buffer,
                caption: `📌 *${query}*`
            }, { quoted: msg }).catch(() => {})
            )
        );
    }
};
