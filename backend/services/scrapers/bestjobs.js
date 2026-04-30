const { newPage } = require('../browser');

const NAME = 'BestJobs';
const ORIGIN = 'https://www.bestjobs.eu';

function slug(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildUrl(query, location) {
  const qSlug = slug(query);
  const lSlug = slug(location);
  const path =
    qSlug && lSlug ? `/locuri-de-munca/${qSlug}/${lSlug}`
    : qSlug ? `/locuri-de-munca/${qSlug}`
    : `/locuri-de-munca`;
  return `${ORIGIN}${path}`;
}

async function scrape({ query, location, limit = 25, timeoutMs = 25000 }) {
  const page = await newPage();
  const url = buildUrl(query, location);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page
      .waitForSelector('a[href^="/loc-de-munca/"]', { timeout: timeoutMs })
      .catch(() => {});

    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await new Promise((r) => setTimeout(r, 600));
    }

    const jobs = await page.evaluate((max, origin) => {
      const out = [];
      const seen = new Set();
      document.querySelectorAll('a[href^="/loc-de-munca/"]').forEach((a) => {
        if (out.length >= max) return;
        const href = a.getAttribute('href') || '';
        if (!href || seen.has(href)) return;
        // walk up to a card-like ancestor
        let card = a;
        for (let i = 0; i < 6 && card; i++) {
          if (card.querySelector && card.querySelector('h2')) break;
          card = card.parentElement;
        }
        if (!card) return;
        const titleEl = card.querySelector('h2');
        if (!titleEl) return;
        const title = titleEl.textContent.trim();
        if (!title) return;
        seen.add(href);
        const companyEl = card.querySelector('.text-ink-medium, [class*="text-ink"]');
        out.push({
          externalId: `bestjobs:${href}`,
          title,
          company: companyEl && companyEl.textContent.trim(),
          location: null,
          url: href.startsWith('http') ? href : `${origin}${href}`,
        });
      });
      return out;
    }, limit, ORIGIN);

    return jobs.map((j) => ({
      ...j,
      source: NAME,
      remote: /remote/i.test(`${j.title} ${j.location || ''}`),
      salary: null,
      description: null,
      postedAt: null,
    }));
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { name: 'bestjobs', scrape, label: NAME };
