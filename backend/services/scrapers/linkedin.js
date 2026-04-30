const { newPage } = require('../browser');

const NAME = 'LinkedIn';

function buildUrl(query, location) {
  const params = new URLSearchParams();
  if (query) params.set('keywords', query);
  if (location) params.set('location', location);
  params.set('sortBy', 'DD');
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

async function scrape({ query, location, limit = 25, timeoutMs = 25000 }) {
  const page = await newPage();
  const url = buildUrl(query, location);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page
      .waitForSelector('ul.jobs-search__results-list li, .job-search-card, .base-card', {
        timeout: timeoutMs,
      })
      .catch(() => {});

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 700));
    }

    const jobs = await page.evaluate((max) => {
      const out = [];
      const seen = new Set();
      const cards = document.querySelectorAll(
        'ul.jobs-search__results-list li, .job-search-card, .base-card',
      );
      cards.forEach((card) => {
        if (out.length >= max) return;
        const titleEl =
          card.querySelector('.base-search-card__title') ||
          card.querySelector('h3');
        const companyEl =
          card.querySelector('.base-search-card__subtitle a') ||
          card.querySelector('.base-search-card__subtitle') ||
          card.querySelector('h4');
        const locEl = card.querySelector('.job-search-card__location');
        const link =
          card.querySelector('a.base-card__full-link') ||
          card.querySelector('a');
        const timeEl = card.querySelector('time');
        const dataId = card.getAttribute('data-entity-urn') || '';
        const title = titleEl && titleEl.textContent.trim();
        const company = companyEl && companyEl.textContent.trim();
        const loc = locEl && locEl.textContent.trim();
        const href = link && link.href;
        if (!title || !href) return;
        const cleanUrl = href.split('?')[0];
        const dedupeKey = `${(title || '').toLowerCase()}|${(company || '').toLowerCase()}`;
        if (seen.has(cleanUrl) || seen.has(dedupeKey)) return;
        seen.add(cleanUrl);
        seen.add(dedupeKey);
        out.push({
          externalId: `linkedin:${dataId || cleanUrl}`,
          title,
          company,
          location: loc,
          url: cleanUrl,
          postedAt: timeEl ? timeEl.getAttribute('datetime') : null,
        });
      });
      return out;
    }, limit);

    return jobs.map((j) => ({
      ...j,
      source: NAME,
      remote: /remote/i.test(`${j.title} ${j.location}`),
      salary: null,
      description: null,
      postedAt: j.postedAt ? new Date(j.postedAt) : null,
    }));
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { name: 'linkedin', scrape, label: NAME };
