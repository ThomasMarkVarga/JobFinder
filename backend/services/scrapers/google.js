const { newPage } = require('../browser');

const NAME = 'Web';

// Domains already covered by dedicated scrapers — filtered out so this
// scraper only surfaces *additional* jobs from sources we don't see.
const EXCLUDE_DOMAINS = [
  'linkedin.com',
  'indeed.com',
  'weworkremotely.com',
  'ejobs.ro',
  'bestjobs.eu',
  'youtube.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'reddit.com',
  'wikipedia.org',
  'quora.com',
  'pinterest.com',
  'duckduckgo.com',
  'google.com',
];

// Hosts that are obviously job postings — trusted even without job-y title.
const KNOWN_JOB_HOSTS = [
  'glassdoor.com',
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'workable.com',
  'workatastartup.com',
  'breezy.hr',
  'recruitee.com',
  'smartrecruiters.com',
  'bamboohr.com',
  'jobvite.com',
  'careers.google.com',
  'jobs.apple.com',
  'amazon.jobs',
  'careers.microsoft.com',
  'wellfound.com',
  'angel.co',
  'hh.ro',
  'undelucram.ro',
  'simplyhired.com',
  'monster.com',
  'jora.com',
  'jobsdb.com',
  'totaljobs.com',
  'reed.co.uk',
  'cv-library.co.uk',
  'stepstone.com',
  'xing.com',
  'remote.co',
  'remoteco.com',
  'remotive.com',
  'flexjobs.com',
  'arbeitnow.com',
];

function deriveCompany(host, urlObj) {
  if (host.endsWith('greenhouse.io')) {
    const m = urlObj.pathname.match(/^\/([^/]+)\//);
    if (m) return m[1];
  }
  if (host.endsWith('lever.co')) {
    const m = urlObj.pathname.match(/^\/([^/]+)\//);
    if (m) return m[1];
  }
  if (host.endsWith('ashbyhq.com')) {
    const m = urlObj.pathname.match(/^\/([^/]+)\//);
    if (m) return m[1];
  }
  if (host.endsWith('workable.com')) {
    if (host !== 'workable.com' && !host.startsWith('apply.')) {
      return host.replace(/\.workable\.com$/, '');
    }
    const m = urlObj.pathname.match(/^\/([^/]+)\//);
    if (m) return m[1];
  }
  return host.replace(/^www\./, '');
}

function looksJobby(title, snippet) {
  return /\b(job|career|position|role|hiring|engineer|developer|programmer|manager|designer|analyst|specialist|consultant|architect|lead|senior|junior|intern)/i.test(
    `${title} ${snippet || ''}`,
  );
}

function passesFilter(host, title, snippet) {
  if (EXCLUDE_DOMAINS.some((d) => host === d || host.endsWith('.' + d))) return false;
  const isJobHost = KNOWN_JOB_HOSTS.some((d) => host === d || host.endsWith('.' + d));
  return isJobHost || looksJobby(title, snippet);
}

function normalize(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!r.url || !r.title) continue;
    let host;
    try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (!passesFilter(host, r.title, r.snippet)) continue;
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    let company = host;
    try { company = deriveCompany(host, new URL(r.url)); } catch {}
    out.push({
      externalId: `web:${r.url}`,
      source: NAME,
      title: r.title,
      company,
      location: null,
      remote: /remote|work from home|wfh/i.test(`${r.title} ${r.snippet || ''}`),
      salary: null,
      description: r.snippet || null,
      url: r.url,
      postedAt: null,
    });
  }
  return out;
}

async function scrapeGoogle(page, query, location, limit, timeoutMs) {
  const parts = [query, location ? `in ${location}` : '', 'jobs'].filter(Boolean);
  const params = new URLSearchParams({ q: parts.join(' '), hl: 'en', num: '30' });
  const url = `https://www.google.com/search?${params.toString()}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

  const consent = await page.$(
    'button[aria-label*="Accept" i], button[aria-label*="Reject" i], #L2AGLb',
  );
  if (consent) {
    await consent.click().catch(() => {});
    await new Promise((r) => setTimeout(r, 500));
  }

  if (page.url().includes('/sorry/')) throw new Error('google-captcha');
  const captcha = await page.$('form[action*="/sorry/"], #captcha-form');
  if (captcha) throw new Error('google-captcha');

  await page
    .waitForSelector('div.MjjYud, div.g, div[data-hveid] h3', { timeout: timeoutMs })
    .catch(() => {});

  return await page.evaluate((max) => {
    const out = [];
    const items = document.querySelectorAll('div.MjjYud, div.g, div[data-hveid]');
    items.forEach((item) => {
      if (out.length >= max) return;
      const a = item.querySelector('a[href^="http"]');
      const h3 = item.querySelector('h3');
      if (!a || !h3) return;
      const snippetEl = item.querySelector(
        '[data-sncf="1"], .VwiC3b, .yXK7lf, [data-sncf], .lEBKkf',
      );
      out.push({
        url: a.href,
        title: h3.textContent.trim(),
        snippet: snippetEl ? snippetEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) : null,
      });
    });
    return out;
  }, limit * 2);
}

async function scrapeDuckDuckGo(page, query, location, limit, timeoutMs) {
  const parts = [query, location ? `in ${location}` : '', 'jobs'].filter(Boolean);
  const params = new URLSearchParams({ q: parts.join(' ') });
  const url = `https://html.duckduckgo.com/html/?${params.toString()}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForSelector('.result, .web-result', { timeout: timeoutMs }).catch(() => {});

  return await page.evaluate((max) => {
    const out = [];
    const items = document.querySelectorAll('.result, .web-result');
    items.forEach((item) => {
      if (out.length >= max) return;
      const a = item.querySelector('a.result__a, a.result__url, a[href^="http"]');
      const titleEl = item.querySelector('.result__title, h2');
      const snippetEl = item.querySelector('.result__snippet');
      if (!a) return;
      let url = a.getAttribute('href') || '';
      // DDG sometimes wraps in /l/?uddg=...
      const m = url.match(/uddg=([^&]+)/);
      if (m) {
        try { url = decodeURIComponent(m[1]); } catch {}
      }
      const title = (titleEl ? titleEl.textContent : a.textContent).trim();
      if (!url || !title) return;
      out.push({
        url,
        title,
        snippet: snippetEl ? snippetEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) : null,
      });
    });
    return out;
  }, limit * 2);
}

async function scrape({ query, location, limit = 25, timeoutMs = 25000 }) {
  const page = await newPage();
  try {
    let rows = [];
    let usedEngine = 'google';
    try {
      rows = await scrapeGoogle(page, query, location, limit, timeoutMs);
    } catch (e) {
      if (e.message === 'google-captcha') {
        usedEngine = 'duckduckgo';
        rows = await scrapeDuckDuckGo(page, query, location, limit, timeoutMs);
      } else {
        throw e;
      }
    }
    if (rows.length === 0 && usedEngine === 'google') {
      rows = await scrapeDuckDuckGo(page, query, location, limit, timeoutMs);
      usedEngine = 'duckduckgo';
    }
    if (process.env.DEBUG_WEB) {
      console.log(`[web] engine=${usedEngine} raw=${rows.length}`);
    }
    return normalize(rows).slice(0, limit);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { name: 'google', scrape, label: NAME };
