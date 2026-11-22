import { describe, expect, it } from 'vitest';
import {
  currentLap,
  finishProgress,
  formatTime,
  ordinal,
  roman,
  startRace,
  startStagger,
  stepRace,
} from './race';

describe('stepRace', () => {
  it('counts time and completed laps while racing', () => {
    let race = startRace();
    race = stepRace(race, 3.9, 4.1, 0.5, 7);
    expect(race).toEqual({ phase: 'racing', elapsed: 0.5, lapsDone: 1, finishTime: null });
    expect(currentLap(race, 7)).toBe(2);
  });

  it('does not count laps before the start line', () => {
    const race = stepRace(startRace(), -0.2, -0.1, 0.1, 7);
    expect(race.lapsDone).toBe(0);
  });

  it('finishes at the line, timing the crossing within the step', () => {
    const before = { ...startRace(), elapsed: 100, lapsDone: 6 };
    const race = stepRace(before, 27.9, 28.1, 0.2, 7);
    expect(race.phase).toBe('finished');
    expect(race.lapsDone).toBe(7);
    expect(race.finishTime).toBeCloseTo(100.1);
  });

  it('stops the clock once finished', () => {
    const finished = stepRace(startRace(), 3.9, 4.1, 1, 1);
    expect(stepRace(finished, 4.1, 4.5, 1, 1)).toBe(finished);
  });

  it('shows the last lap, not one beyond it, once finished', () => {
    const finished = stepRace(startRace(), 3.9, 4.1, 1, 1);
    expect(currentLap(finished, 1)).toBe(1);
  });
});

describe('finishProgress', () => {
  it('is four segments per lap', () => {
    expect(finishProgress(7)).toBe(28);
  });
});

describe('formatTime', () => {
  it.each([
    [0, '0:00.0'],
    [9.96, '0:09.9'],
    [61.25, '1:01.2'],
    [125.5, '2:05.5'],
  ])('formats %d seconds as %s', (seconds, text) => {
    expect(formatTime(seconds)).toBe(text);
  });
});

describe('roman', () => {
  it.each([
    [1, 'I'],
    [4, 'IV'],
    [7, 'VII'],
    [9, 'IX'],
    [14, 'XIV'],
    [40, 'XL'],
    [1999, 'MCMXCIX'],
  ])('writes %d as %s', (n, text) => {
    expect(roman(n)).toBe(text);
  });

  it('falls back to digits for zero and fractions', () => {
    expect(roman(0)).toBe('0');
    expect(roman(2.5)).toBe('2.5');
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [21, '21st'],
  ])('writes %d as %s', (n, text) => {
    expect(ordinal(n)).toBe(text);
  });
});

describe('startStagger', () => {
  it('starts outer chariots further forward', () => {
    expect(startStagger(1.5, 1.5)).toBe(0);
    expect(startStagger(11.5, 1.5)).toBe(5);
  });

  it('never starts anyone behind the inside chariot', () => {
    expect(startStagger(1, 1.5)).toBe(0);
  });
});
