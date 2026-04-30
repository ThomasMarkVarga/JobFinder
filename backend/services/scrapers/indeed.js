const { newPage } = require('../browser');

const NAME = 'Indeed';

function buildUrl(query, location) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (location) params.set('l', location);
  params.set('sort', 'date');
  return `https://www.indeed.com/jobs?${params.toString()}`;
}

async function scrape({ query, location, limit = 25, timeoutMs = 25000 }) {
  const page = await newPage();
  const url = buildUrl(query, location);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page
      .waitForSelector('div.job_seen_beacon, [data-testid="slider_item"], .resultContent', {
        timeout: timeoutMs,
      })
      .catch(() => {});

    const jobs = await page.evaluate((max) => {
      const out = [];
      const cards = document.querySelectorAll(
        'div.job_seen_beacon, [data-testid="slider_item"]',
      );
      cards.forEach((card) => {
        if (out.length >= max) return;
        const titleA =
          card.querySelector('h2.jobTitle a') ||
          card.querySelector('a.jcs-JobTitle') ||
          card.querySelector('h2 a');
        const company =
          card.querySelector('[data-testid="company-name"]') ||
          card.querySelector('.companyName');
        const loc =
          card.querySelector('[data-testid="text-location"]') ||
          card.querySelector('.companyLocation');
        const salary =
          card.querySelector('[data-testid="attribute_snippet_testid"]') ||
          card.querySelector('.salary-snippet, .estimated-salary');
        const snippet =
          card.querySelector('[data-testid="job-snippet"]') ||
          card.querySelector('.job-snippet');
        const dateEl = card.querySelector('[data-testid="myJobsStateDate"], .date');
        const id = (titleA && (titleA.getAttribute('data-jk') || titleA.id)) || '';
        const title = titleA && titleA.textContent.trim();
        const href = titleA && titleA.href;
        if (!title || !href) return;
        const fullUrl = href.startsWith('http')
          ? href
          : `https://www.indeed.com${href}`;
        out.push({
          externalId: `indeed:${id || fullUrl}`,
          title,
          company: company && company.textContent.trim(),
          location: loc && loc.textContent.trim(),
          salary: salary && salary.textContent.trim(),
          description: snippet && snippet.textContent.replace(/\s+/g, ' ').trim().slice(0, 600),
          url: fullUrl,
          postedAt: dateEl && dateEl.textContent.trim(),
        });
      });
      return out;
    }, limit);

    return jobs.map((j) => ({
      ...j,
      source: NAME,
      remote: /remote/i.test(`${j.title} ${j.location || ''}`),
      postedAt: null,
    }));
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { name: 'indeed', scrape, label: NAME };
