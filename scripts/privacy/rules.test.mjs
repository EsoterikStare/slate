import { describe, expect, it } from 'vitest';
import { findProblems, isPublishableEmail, mask, parseDenylist } from './rules.mjs';

// Example values are neutral (not anyone's real addresses) and assembled at
// runtime, so this file contains no literal private IP, personal email or
// Windows home folder for the privacy check itself to trip over.
const ip = (...parts) => parts.join('.');
const at = (user, domain) => `${user}@${domain}`;
const winHome = (name) => ['C:', 'Users', name].join('\\');

const kinds = (text, deny) => findProblems(text, deny).map((p) => `${p.line}:${p.kind}:${p.match}`);

describe('findProblems', () => {
  it('flags personal email addresses but allows noreply and example ones', () => {
    const personal = at('someone', 'mailprovider.test');
    expect(kinds(`mail me at ${personal}`)).toEqual([`1:email address:${personal}`]);
    expect(
      kinds(
        `Co-Authored-By: Claude <${at('noreply', 'anthropic.com')}>\n` +
          `author: ${at('123+someone', 'users.noreply.github.com')}\n` +
          `e.g. ${at('you', 'example.com')}`,
      ),
    ).toEqual([]);
  });

  it('flags private and carrier-grade-NAT IP addresses, not public or placeholder ones', () => {
    const lan = ip(192, 168, 0, 10);
    const ten = ip(10, 0, 0, 5);
    const cgnat = ip(100, 64, 0, 1);
    const docker = ip(172, 16, 0, 5);
    expect(kinds(`a ${lan}\nb ${ten}\nc ${cgnat}\nd ${docker}`)).toEqual([
      `1:private IP address:${lan}`,
      `2:private IP address:${ten}`,
      `3:private IP address:${cgnat}`,
      `4:private IP address:${docker}`,
    ]);
    expect(kinds(`dns ${ip(9, 9, 9, 9)}\n<pi-ip>/32\nversion 10.2.0`)).toEqual([]);
  });

  it('flags a Windows home folder that names the account, not a placeholder', () => {
    expect(kinds(`${winHome('jdoe')}\\.ssh\\key`)).toEqual([`1:Windows user folder:${winHome('jdoe')}`]);
    expect(kinds(`${winHome('<you>')}\\.ssh and ${winHome('%USERNAME%')}\\x`)).toEqual([]);
  });

  it('flags denylisted terms case-insensitively, as whole words only', () => {
    const deny = ['Jordan', 'f00dcafe'];
    expect(kinds('calendar for JORDAN\nid f00dcafe here', deny)).toEqual([
      '1:denylisted term:Jordan',
      '2:denylisted term:f00dcafe',
    ]);
    // Not inside other words, so short names don't flag unrelated text.
    expect(kinds('jordanian food, f00dcafe12', deny)).toEqual([]);
  });

  it('treats regex characters in denylisted terms literally', () => {
    expect(kinds('a+b and axb', ['a+b'])).toEqual(['1:denylisted term:a+b']);
  });
});

describe('parseDenylist', () => {
  it('ignores blank lines and comments', () => {
    expect(parseDenylist('# names\nJordan\n\n  f00dcafe  \r\n# end')).toEqual(['Jordan', 'f00dcafe']);
  });
});

describe('isPublishableEmail', () => {
  it('accepts only noreply-style addresses', () => {
    expect(isPublishableEmail(at('12345678+someone', 'users.noreply.github.com'))).toBe(true);
    expect(isPublishableEmail(at('someone', 'mailprovider.test'))).toBe(false);
  });
});

describe('mask', () => {
  it('keeps only the first two characters', () => {
    expect(mask(at('someone', 'mailprovider.test'))).toBe('so••••••••••••');
    expect(mask('ab')).toBe('••');
  });
});
