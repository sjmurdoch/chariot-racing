import { describe, expect, it } from 'vitest';
import { countersLeft } from './lap-counters';

describe('countersLeft', () => {
  it('starts with all seven up for a seven-lap race', () => {
    expect(countersLeft(0, 7)).toBe(7);
  });

  it('takes one down for each lap completed', () => {
    expect(countersLeft(1, 7)).toBe(6);
    expect(countersLeft(7, 7)).toBe(0);
  });

  it('uses only as many as there are laps, at most seven', () => {
    expect(countersLeft(0, 3)).toBe(3);
    expect(countersLeft(0, 10)).toBe(7);
  });

  it('never goes below zero', () => {
    expect(countersLeft(9, 7)).toBe(0);
    expect(countersLeft(-1, 7)).toBe(7);
  });
});
