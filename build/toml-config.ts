// Vite plugin: imports a TOML file as a JSON module, applying CHARIOT_*
// environment variable overrides at build time.

import { readFileSync } from 'node:fs';
import { parse } from 'smol-toml';
import type { Plugin } from 'vite';
import { applyOverrides, envValues, type ConfigTree } from '../src/config/overrides.ts';

export function loadTomlConfig(
  path: string,
  env: Record<string, string | undefined>,
): { config: ConfigTree; warnings: string[]; applied: { key: string; source: string }[] } {
  const defaults = parse(readFileSync(path, 'utf8')) as ConfigTree;
  return applyOverrides(defaults, envValues(defaults, env), 'environment');
}

export function tomlConfig(): Plugin {
  return {
    name: 'chariot-toml-config',
    transform(_code, id) {
      if (!id.endsWith('.toml')) return null;
      const { config, warnings, applied } = loadTomlConfig(id, process.env);
      for (const warning of warnings) this.warn(warning);
      for (const { key } of applied) this.info(`config ${key} overridden from environment`);
      this.addWatchFile(id);
      return { code: `export default ${JSON.stringify(config)};`, map: null };
    },
  };
}
