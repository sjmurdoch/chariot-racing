import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, initialChoices, saveChoices, type ChoiceStorage, type Choices } from './choices';

const defaults: Choices = { faction: 'prasina', difficulty: 'normal' };

function memoryStorage(initial: Record<string, string> = {}): ChoiceStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('DIFFICULTIES', () => {
  it('makes rivals slower on easy and faster on hard', () => {
    expect(DIFFICULTIES.easy.skill).toBeLessThan(1);
    expect(DIFFICULTIES.normal.skill).toBe(1);
    expect(DIFFICULTIES.hard.skill).toBeGreaterThan(1);
  });
});

describe('initialChoices', () => {
  it('uses the defaults the first time', () => {
    expect(initialChoices(defaults, {}, memoryStorage())).toEqual(defaults);
  });

  it('remembers what the player chose last time', () => {
    const storage = memoryStorage();
    saveChoices({ faction: 'veneta', difficulty: 'hard' }, storage);
    expect(initialChoices(defaults, {}, storage)).toEqual({ faction: 'veneta', difficulty: 'hard' });
  });

  it('lets explicit settings win over remembered ones', () => {
    const storage = memoryStorage();
    saveChoices({ faction: 'veneta', difficulty: 'hard' }, storage);
    expect(initialChoices(defaults, { faction: 'albata' }, storage)).toEqual({
      faction: 'albata',
      difficulty: 'hard',
    });
  });

  it('ignores remembered values that are not valid', () => {
    const storage = memoryStorage({
      'circus-maximus.choices': JSON.stringify({ faction: 'purpurea', difficulty: 'insane' }),
    });
    expect(initialChoices(defaults, {}, storage)).toEqual(defaults);
  });

  it('ignores corrupt or unavailable storage', () => {
    expect(initialChoices(defaults, {}, memoryStorage({ 'circus-maximus.choices': '{oops' }))).toEqual(
      defaults,
    );
    expect(initialChoices(defaults, {}, null)).toEqual(defaults);
    const throwing: ChoiceStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(initialChoices(defaults, {}, throwing)).toEqual(defaults);
    expect(() => saveChoices(defaults, throwing)).not.toThrow();
  });
});
