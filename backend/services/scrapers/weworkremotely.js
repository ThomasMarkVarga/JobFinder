const { newPage } = require('../browser');

const NAME = 'WeWorkRemotely';
const ORIGIN = 'https://weworkremotely.com';

function buildUrl(query) {
  const params = new URLSearchParams();
  if (query) params.set('term', query);
  return `${ORIGIN}/remote-jobs/search?${params.toString()}`;
}

async function scrape({ query, limit = 25, timeoutMs = 25000 }) {
  const page = await newPage();
  const url = buildUrl(query);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForSelector('section.jobs li, ul.jobs li, li.feature', { timeout: timeoutMs }).catch(() => {});

    const jobs = await page.evaluate((max, origin) => {
      const out = [];
      const items = document.querySelectorAll('section.jobs li, ul.jobs li, li.feature');
      items.forEach((li) => {
        if (out.length >= max) return;
        const a = li.querySelector('a[href^="/remote-jobs/"]');
        if (!a) return;
        const title = (li.querySelector('.title') || a).textContent.trim();
        const company = (li.querySelector('.company') || {}).textContent
          ? li.querySelector('.company').textContent.trim()
          : null;
        const region = (li.querySelector('.region') || {}).textContent
          ? li.querySelector('.region').textContent.trim()
          : 'Remote';
        const href = a.getAttribute('href');
        out.push({
          externalId: `wwr:${href}`,
          title,
          company,
          location: region,
          url: `${origin}${href}`,
        });
      });
      return out;
    }, limit, ORIGIN);

    return jobs.map((j) => ({
      ...j,
      source: NAME,
      remote: true,
      salary: null,
      description: null,
      postedAt: null,
    }));
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { name: 'weworkremotely', scrape, label: NAME };
