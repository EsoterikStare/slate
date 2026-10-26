// What counts as personal data that must not be committed to this public
// repo. Generic patterns live here; the specific names, usernames, addresses
// and IDs belong in `.privacy-denylist`, which is git-ignored so it never
// publishes the very things it protects.

/** Emails that are fine to publish: GitHub/Anthropic noreply and documentation examples. */
const ALLOWED_EMAIL = [
  /@users\.noreply\.github\.com$/i,
  /^noreply@(anthropic|github)\.com$/i,
  /@example\.(com|org|net)$/i,
];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// RFC 1918 private ranges, plus 100.64/10 (carrier-grade NAT, used by Tailscale).
const PRIVATE_IP =
  /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01])|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\.\d{1,3}\.\d{1,3}\b/g;
// A Windows home folder reveals the account name: C:\Users\<name>\...
const WINDOWS_HOME = /\b[A-Za-z]:[\\/]+Users[\\/]+([^\\/\s'"`<>]+)/gi;
const PLACEHOLDER = /^<.*>$|^%USERNAME%$|^\$env:USERNAME$/i;

/** Parses the denylist: one term per line; blank lines and `#` comments ignored. */
export function parseDenylist(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Personal data found in `text`, one entry per match, with 1-based line
 * numbers. Denylisted terms match case-insensitively on word boundaries.
 */
export function findProblems(text, denylist = []) {
  const problems = [];
  const lines = text.split(/\r?\n/);
  const terms = denylist.map((t) => ({ term: t, re: new RegExp(`(?<![A-Za-z0-9])${escape(t)}(?![A-Za-z0-9])`, 'i') }));
  lines.forEach((line, i) => {
    const at = i + 1;
    for (const m of line.matchAll(EMAIL)) {
      if (!ALLOWED_EMAIL.some((a) => a.test(m[0]))) problems.push({ line: at, kind: 'email address', match: m[0] });
    }
    for (const m of line.matchAll(PRIVATE_IP)) problems.push({ line: at, kind: 'private IP address', match: m[0] });
    for (const m of line.matchAll(WINDOWS_HOME)) {
      if (!PLACEHOLDER.test(m[1])) problems.push({ line: at, kind: 'Windows user folder', match: m[0] });
    }
    for (const { term, re } of terms) {
      if (re.test(line)) problems.push({ line: at, kind: 'denylisted term', match: term });
    }
  });
  return problems;
}

/**
 * Hides most of a match for output that others can read (CI logs on a public
 * repo), so reporting a leak doesn't repeat it: only the first two characters
 * stay visible.
 */
export function mask(value) {
  return value.length <= 2 ? '••' : value.slice(0, 2) + '•'.repeat(Math.min(value.length - 2, 12));
}

/** Whether a commit author/committer email is safe to publish. */
export function isPublishableEmail(email) {
  return ALLOWED_EMAIL.some((a) => a.test(email.trim()));
}
