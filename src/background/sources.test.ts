import { describe, expect, it } from 'vitest';
import { createFakeHass } from '../ha/fake-hass';
import { backgroundUrl, validateBackground } from './sources';

describe('backgroundUrl', () => {
  it('uses an entity’s entity_picture (e.g. the Unsplash sensor)', () => {
    const hass = createFakeHass({
      entities: { 'sensor.unsplash_background': { state: 'ok', attributes: { entity_picture: '/api/image/abc' } } },
    });
    expect(backgroundUrl({ entity: 'sensor.unsplash_background' }, hass, 0)).toBe('/api/image/abc');
  });

  it('falls back to an entity state that is a URL', () => {
    const hass = createFakeHass({ entities: { 'input_text.bg': { state: 'https://example.com/a.jpg' } } });
    expect(backgroundUrl({ entity: 'input_text.bg' }, hass, 0)).toBe('https://example.com/a.jpg');
  });

  it('shows nothing for a missing entity or a non-URL state', () => {
    const hass = createFakeHass({ entities: { 'sensor.x': { state: 'unavailable' } } });
    expect(backgroundUrl({ entity: 'sensor.x' }, hass, 0)).toBeUndefined();
    expect(backgroundUrl({ entity: 'sensor.missing' }, hass, 0)).toBeUndefined();
  });

  it('rotates through a list, wrapping around', () => {
    const urls = ['a.jpg', 'b.jpg', 'c.jpg'];
    expect([0, 1, 2, 3].map((t) => backgroundUrl({ urls }, undefined, t))).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'a.jpg']);
  });

  it('busts the cache on a single URL only when it rotates', () => {
    expect(backgroundUrl({ url: 'https://picsum.photos/1080/1920' }, undefined, 5)).toBe('https://picsum.photos/1080/1920');
    expect(backgroundUrl({ url: 'https://picsum.photos/1080/1920', interval: 10 }, undefined, 5)).toBe(
      'https://picsum.photos/1080/1920?wall_t=5',
    );
    expect(backgroundUrl({ url: 'https://x/img?grayscale', interval: 10 }, undefined, 2)).toBe('https://x/img?grayscale&wall_t=2');
  });
});

describe('validateBackground', () => {
  it.each([{}, { url: 'a', urls: ['b'] }, { urls: [] }, { url: 'a', interval: 0 }])('rejects %j', (bad) => {
    expect(() => validateBackground(bad)).toThrow(/background/);
  });
});
