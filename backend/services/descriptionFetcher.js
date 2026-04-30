// Generic full-job-description fetcher. Opens an arbitrary URL with the shared
// Puppeteer instance and returns the largest readable text block on the page.

const { newPage } = require('./browser');

const detailCache = new Map(); // url -> { at, text }
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function fetchDetail(url, { timeoutMs = 18000 } = {}) {
  const cached = detailCache.get(url);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.text;

  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await new Promise((r) => setTimeout(r, 700));

    const text = await page.evaluate(() => {
      // strip nav/footer/script/style
      document.querySelectorAll('script, style, noscript, nav, header, footer, aside').forEach((n) => n.remove());

      // pick the densest content block
      const candidates = Array.from(
        document.querySelectorAll(
          'article, main, [role="main"], .description, .job-description, .show-more-less-html, [class*="description"], [class*="JobDescription"]',
        ),
      );
      let best = null;
      let bestLen = 0;
      for (const el of candidates) {
        const len = el.innerText.trim().length;
        if (len > bestLen) {
          best = el;
          bestLen = len;
        }
      }
      const fallback = document.body && document.body.innerText.trim();
      const out = best ? best.innerText.trim() : fallback || '';
      return out.replace(/\s+/g, ' ').slice(0, 8000);
    });

    detailCache.set(url, { at: Date.now(), text });
    return text;
  } finally {
    await page.close().catch(() => {});
  }
}

function clearDetailCache() {
  detailCache.clear();
}

module.exports = { fetchDetail, clearDetailCache };
