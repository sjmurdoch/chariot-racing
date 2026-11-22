// Pure helpers for layering configuration overrides onto defaults.
//
// Settings are addressed by a dotted key, "<table>.<key>", matching the TOML
// layout. The same key maps to an environment variable CHARIOT_<TABLE>_<KEY>
// (build time) and to a URL query parameter <table>.<key> (runtime).
//
// This module runs both in Node (from the Vite plugin) and in the browser,
// so it has no dependencies.

export const ENV_PREFIX = 'CHARIOT_';

export type Scalar = string | number | boolean;
export type ConfigTree = { [key: string]: Scalar | ConfigTree };

export interface OverrideResult<T> {
  config: T;
  /** Human-readable problems found, for the caller to report. */
  warnings: string[];
  /** Dotted keys that were overridden, with the source of each. */
  applied: { key: string; source: string }[];
}

/** Lists every leaf setting as [dottedKey, defaultValue]. */
export function flattenKeys(tree: ConfigTree, prefix = ''): [string, Scalar][] {
  const out: [string, Scalar][] = [];
  for (const [name, value] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof value === 'object') {
      out.push(...flattenKeys(value, key));
    } else {
      out.push([key, value]);
    }
  }
  return out;
}

/** The environment variable name for a dotted key: race.laps -> CHARIOT_RACE_LAPS. */
export function envName(key: string): string {
  return ENV_PREFIX + key.replaceAll('.', '_').toUpperCase();
}

/** Converts a string to the type of the default, or returns undefined if it can't. */
export function coerce(raw: string, like: Scalar): Scalar | undefined {
  const text = raw.trim();
  switch (typeof like) {
    case 'number': {
      if (text === '') return undefined;
      const n = Number(text);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean': {
      const lower = text.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lower)) return true;
      if (['false', '0', 'no', 'off'].includes(lower)) return false;
      return undefined;
    }
    default:
      return raw;
  }
}

function setPath(tree: ConfigTree, key: string, value: Scalar): void {
  const parts = key.split('.');
  let node = tree;
  for (const part of parts.slice(0, -1)) {
    node = node[part] as ConfigTree;
  }
  node[parts[parts.length - 1]!] = value;
}

/**
 * Returns a copy of `base` with values from `values` applied.
 *
 * `values` maps dotted keys to raw strings. Values that can't be converted to
 * the type of the default are skipped with a warning. Keys containing a dot
 * that don't name a setting produce a warning, since they are probably typos;
 * other keys are ignored, so unrelated URL parameters are harmless.
 */
export function applyOverrides<T extends ConfigTree>(
  base: T,
  values: Record<string, string>,
  source: string,
): OverrideResult<T> {
  const config = structuredClone(base);
  const defaults = new Map(flattenKeys(base));
  const warnings: string[] = [];
  const applied: { key: string; source: string }[] = [];

  for (const [key, raw] of Object.entries(values)) {
    const like = defaults.get(key);
    if (like === undefined) {
      if (key.includes('.')) {
        warnings.push(`Unknown setting "${key}" from ${source}; ignoring it`);
      }
      continue;
    }
    const value = coerce(raw, like);
    if (value === undefined) {
      warnings.push(
        `Setting "${key}" from ${source} should be a ${typeof like}, got "${raw}"; keeping ${String(like)}`,
      );
      continue;
    }
    setPath(config, key, value);
    applied.push({ key, source });
  }
  return { config, warnings, applied };
}

/** Picks the overrides for `base` out of an environment such as process.env. */
export function envValues(
  base: ConfigTree,
  env: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key] of flattenKeys(base)) {
    const raw = env[envName(key)];
    if (raw !== undefined) out[key] = raw;
  }
  return out;
}

/** Collects URL query parameters into a plain object (last value wins). */
export function queryValues(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search));
}
