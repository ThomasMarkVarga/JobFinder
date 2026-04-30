const { newPage } = require('../browser');

const NAME = 'eJobs';
const ORIGIN = 'https://www.ejobs.ro';

function buildUrl(query, location) {
  const params = new URLSearchParams();
  if (query) params.set('keyword', query);
  if (location) params.set('location', location);
  return `${ORIGIN}/locuri-de-munca?${params.toString()}`;
}

async function scrape({ query, location, limit = 25, timeoutMs = 25000 }) {
  const page = await newPage();
  const url = buildUrl(query, location);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForSelector('.job-card', { timeout: timeoutMs }).catch(() => {});

    // virtual scroll: keep scrolling until enough cards or no growth
    // unconditional warm-up scrolls so intersection-observer fires lazy loads
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await new Promise((r) => setTimeout(r, 700));
    }
    let prev = 0;
    let stagnant = 0;
    for (let i = 0; i < 20; i++) {
      const count = await page.$$eval('.job-card', (els) => els.length).catch(() => 0);
      if (count >= limit) break;
      stagnant = count === prev ? stagnant + 1 : 0;
      prev = count;
      if (stagnant >= 4) break;
      await page.evaluate(() => window.scrollBy(0, 1800));
      await new Promise((r) => setTimeout(r, 800));
    }

    const jobs = await page.evaluate((max, origin) => {
      const out = [];
      const seen = new Set();
      document.querySelectorAll('.job-card').forEach((card) => {
        if (out.length >= max) return;
        const titleA = card.querySelector('.job-card-content-middle__title a');
        if (!titleA) return;
        const href = titleA.getAttribute('href') || '';
        if (!href || seen.has(href)) return;
        seen.add(href);
        const title = titleA.textContent.trim();
        const company = card.querySelector(
          'h3.job-card-content-middle__info, .job-card-content-middle__info--darker',
        );
        const loc = card.querySelector(
          'div.job-card-content-middle__info:not(.job-card-content-middle__info--darker)',
        );
        const salary = card.querySelector('.job-card-content-middle__salary');
        const dateEl = card.querySelector('.job-card-content-top__date');
        out.push({
          externalId: `ejobs:${href}`,
          title,
          company: company && company.textContent.trim(),
          location: loc && loc.textContent.replace(/\s+/g, ' ').trim(),
          salary: salary && salary.textContent.trim(),
          url: href.startsWith('http') ? href : `${origin}${href}`,
          postedAtRaw: dateEl && dateEl.textContent.trim(),
        });
      });
      return out;
    }, limit, ORIGIN);

    return jobs.map((j) => ({
      ...j,
      source: NAME,
      remote: /remote/i.test(`${j.title} ${j.location || ''}`),
      description: null,
      postedAt: null,
    }));
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { name: 'ejobs', scrape, label: NAME };
