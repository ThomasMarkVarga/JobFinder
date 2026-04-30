// Tiny theme controller — applies/removes the `dark` class on <html>.

const KEY = 'jobfinder-theme';

export function getTheme() {
  return localStorage.getItem(KEY) || 'dark';
}

export function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light') root.classList.remove('dark');
  else root.classList.add('dark');
  localStorage.setItem(KEY, t);
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
