import { describe, expect, it } from 'vitest';
import {
  applyOverrides,
  coerce,
  envName,
  envValues,
  flattenKeys,
  queryValues,
  valueAt,
  type ConfigTree,
} from './overrides';

const base = {
  race: { laps: 7 },
  render: { max_pixel_ratio: 2, antialias: true },
  debug: { label: 'x' },
} satisfies ConfigTree;

describe('flattenKeys', () => {
  it('lists dotted keys with defaults', () => {
    expect(flattenKeys(base)).toEqual([
      ['race.laps', 7],
      ['render.max_pixel_ratio', 2],
      ['render.antialias', true],
      ['debug.label', 'x'],
    ]);
  });
});

describe('envName', () => {
  it('maps dotted keys to upper-case prefixed names', () => {
    expect(envName('race.laps')).toBe('CHARIOT_RACE_LAPS');
    expect(envName('render.max_pixel_ratio')).toBe('CHARIOT_RENDER_MAX_PIXEL_RATIO');
  });
});

describe('coerce', () => {
  it.each([
    ['3', 7, 3],
    [' 1.5 ', 7, 1.5],
    ['abc', 7, undefined],
    ['', 7, undefined],
    ['Infinity', 7, undefined],
    ['true', false, true],
    ['YES', false, true],
    ['0', true, false],
    ['off', true, false],
    ['maybe', true, undefined],
    ['hello', 'x', 'hello'],
  ] as const)('coerce(%j, like %j) is %j', (raw, like, expected) => {
    expect(coerce(raw, like)).toBe(expected);
  });
});

describe('applyOverrides', () => {
  it('applies typed values without mutating the base', () => {
    const result = applyOverrides(base, { 'race.laps': '3', 'render.antialias': 'false' }, 'URL');
    expect(result.config.race.laps).toBe(3);
    expect(result.config.render.antialias).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.applied).toEqual([
      { key: 'race.laps', source: 'URL' },
      { key: 'render.antialias', source: 'URL' },
    ]);
    expect(base.race.laps).toBe(7);
  });

  it('keeps the default and warns on a bad value', () => {
    const result = applyOverrides(base, { 'race.laps': 'seven' }, 'URL');
    expect(result.config.race.laps).toBe(7);
    expect(result.warnings).toEqual([
      'Setting "race.laps" from URL should be a number, got "seven"; keeping 7',
    ]);
  });

  it('warns on unknown dotted keys but ignores plain ones', () => {
    const result = applyOverrides(base, { 'race.lapz': '3', utm_source: 'x' }, 'URL');
    expect(result.warnings).toEqual(['Unknown setting "race.lapz" from URL; ignoring it']);
    expect(result.applied).toEqual([]);
  });

  it('does not treat a table name as a setting', () => {
    const result = applyOverrides(base, { race: '3' }, 'URL');
    expect(result.config).toEqual(base);
  });
});

describe('valueAt', () => {
  it('reads leaf settings by dotted key', () => {
    expect(valueAt(base, 'race.laps')).toBe(7);
    expect(valueAt(base, 'render.antialias')).toBe(true);
  });

  it('returns undefined for tables and missing keys', () => {
    expect(valueAt(base, 'race')).toBeUndefined();
    expect(valueAt(base, 'race.laps.extra')).toBeUndefined();
    expect(valueAt(base, 'nope.nothing')).toBeUndefined();
  });
});

describe('envValues', () => {
  it('picks only matching environment variables', () => {
    expect(
      envValues(base, { CHARIOT_RACE_LAPS: '5', CHARIOT_OTHER: '1', PATH: '/bin' }),
    ).toEqual({ 'race.laps': '5' });
  });
});

describe('queryValues', () => {
  it('parses a query string', () => {
    expect(queryValues('?race.laps=2&debug.show_fps=1')).toEqual({
      'race.laps': '2',
      'debug.show_fps': '1',
    });
  });
});
