const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const SKILLS_DICTIONARY = [
  // Languages
  'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'go', 'golang',
  'rust', 'c++', 'c#', 'php', 'ruby', 'scala', 'r', 'matlab', 'sql', 'bash',
  // Frontend
  'react', 'vue', 'angular', 'svelte', 'next.js', 'nextjs', 'nuxt', 'redux',
  'tailwind', 'sass', 'webpack', 'vite', 'graphql', 'apollo',
  // Backend
  'node.js', 'nodejs', 'express', 'nestjs', 'django', 'flask', 'fastapi',
  'spring', 'spring boot', 'rails', 'laravel', '.net', 'asp.net',
  // Data / ML
  'pandas', 'numpy', 'pytorch', 'tensorflow', 'keras', 'scikit-learn', 'spark',
  'hadoop', 'airflow', 'dbt', 'snowflake', 'tableau', 'power bi',
  // DBs
  'postgres', 'postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'elasticsearch',
  'cassandra', 'dynamodb', 'sqlite',
  // DevOps / Cloud
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible',
  'jenkins', 'gitlab ci', 'github actions', 'circleci', 'prometheus', 'grafana',
  'linux', 'nginx',
  // Mobile
  'android', 'ios', 'react native', 'flutter', 'xamarin',
  // Misc
  'rest', 'rest api', 'microservices', 'agile', 'scrum', 'jira', 'figma',
  'photoshop', 'illustrator',
];

const TITLE_HINTS = [
  'software engineer', 'software developer', 'frontend developer', 'front-end developer',
  'backend developer', 'back-end developer', 'full stack developer', 'fullstack developer',
  'full-stack developer', 'web developer', 'mobile developer', 'ios developer',
  'android developer', 'devops engineer', 'sre', 'site reliability engineer',
  'data engineer', 'data scientist', 'data analyst', 'machine learning engineer',
  'ml engineer', 'ai engineer', 'qa engineer', 'test engineer', 'product manager',
  'project manager', 'designer', 'ux designer', 'ui designer', 'security engineer',
  'cloud engineer', 'platform engineer', 'engineering manager', 'tech lead',
  'solutions architect', 'systems engineer', 'embedded engineer',
];

const STOPWORDS = new Set([
  'the','a','an','of','and','or','to','in','on','for','with','by','at','as','is',
  'are','was','were','be','been','being','have','has','had','do','does','did','will',
  'would','should','can','could','may','might','i','you','we','they','he','she','it',
  'this','that','these','those','my','your','our','their','from','but','if','then',
  'so','than','about','into','over','under','up','down','out','off','very','more',
  'most','also','just','any','some','all','no','not','than','their','them','than',
  'who','what','when','where','why','how','using','used','use','via','etc','eg',
  'ie','please','include','including','responsible','team','teams','work','working',
  'experience','years','year','strong','good','excellent','knowledge','skills',
  'skill','ability','able','helped','help','built','build','developed','develop',
  'created','create','designed','design','managed','manage','led','lead','leading',
  'across','within','around','company','companies','role','roles','position','positions',
  'project','projects','feature','features','solution','solutions','responsibilities',
  'responsibility','candidate','candidates','requirement','requirements','plus',
  'preferred','required','must','nice','have','having','etc.','various','well',
  'while','during','through','company','industry','best','practice','practices',
]);

async function extractText(filePath, mimetype) {
  const lower = filePath.toLowerCase();
  if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    return data.text || '';
  }
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }
  if (lower.endsWith('.txt') || mimetype === 'text/plain') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  throw new Error(`Unsupported CV format: ${mimetype || path.extname(filePath)}`);
}

function findSkills(text) {
  const lower = text.toLowerCase();
  const found = new Set();
  for (const skill of SKILLS_DICTIONARY) {
    const escaped = skill.replace(/[.+]/g, (c) => `\\${c}`);
    const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    if (re.test(lower)) found.add(skill);
  }
  return [...found];
}

function findTitles(text) {
  const lower = text.toLowerCase();
  const found = new Set();
  for (const title of TITLE_HINTS) {
    if (lower.includes(title)) found.add(title);
  }
  return [...found];
}

function topKeywords(text, limit = 25) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9.+# /-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function guessLocation(text) {
  const m = text.match(/\b(?:based in|located in|residence:?)\s+([A-Z][\w\s,]{2,40})/i);
  if (m) return m[1].trim().replace(/\s+/g, ' ');
  return null;
}

async function parseCv(filePath, mimetype) {
  const rawText = await extractText(filePath, mimetype);
  const skills = findSkills(rawText);
  const titles = findTitles(rawText);
  const keywords = topKeywords(rawText);
  const locationHint = guessLocation(rawText);
  return { rawText, skills, titles, keywords, locationHint };
}

module.exports = { parseCv, SKILLS_DICTIONARY, TITLE_HINTS };
