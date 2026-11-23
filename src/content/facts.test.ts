import { describe, expect, it } from 'vitest';
import { DEPARTURES, FACTS, pickFact } from './facts';

describe('FACTS', () => {
  it('has a source for every fact, linked over https', () => {
    for (const fact of FACTS) {
      expect(fact.source.title.length).toBeGreaterThan(0);
      expect(new URL(fact.source.url).protocol).toBe('https:');
    }
  });

  it('keeps each fact short enough to read between races', () => {
    for (const fact of FACTS) expect(fact.text.length).toBeLessThanOrEqual(170);
  });

  it('has no two facts alike', () => {
    expect(new Set(FACTS.map((f) => f.text)).size).toBe(FACTS.length);
  });

  it('says where the game departs from history', () => {
    expect(DEPARTURES.length).toBeGreaterThan(0);
  });
});

describe('pickFact', () => {
  it('covers every fact across the range', () => {
    expect(pickFact(0)).toBe(FACTS[0]);
    expect(pickFact(0.9999)).toBe(FACTS[FACTS.length - 1]);
    expect(pickFact(1)).toBe(FACTS[FACTS.length - 1]);
  });
});
