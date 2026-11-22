// Vite plugin: provides `virtual:build-info`, describing the build (commit,
// branch, time) so the running game can report exactly what it is.
//
// In GitHub Actions the commit comes from GITHUB_SHA. Locally it comes from
// git, with "-dirty" appended when there are uncommitted changes.

import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';

export interface BuildInfo {
  /** Abbreviated commit hash, "-dirty" if built from uncommitted changes, or "unknown". */
  commit: string;
  /** Full commit hash, or "" if unknown. */
  commitFull: string;
  /** Branch or tag name, or "" if unknown. */
  ref: string;
  /** ISO 8601 time the build started. */
  builtAt: string;
  /** Where the build ran: "github-actions" or "local". */
  builtBy: string;
}

/** Runs git with the given arguments and returns its trimmed output, or undefined on failure. */
export type GitRunner = (args: string[]) => string | undefined;

const SHORT_LENGTH = 7;

export const runGit: GitRunner = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
};

export function resolveBuildInfo(
  env: Record<string, string | undefined>,
  git: GitRunner,
  now: Date = new Date(),
): BuildInfo {
  const builtAt = now.toISOString();
  if (env.GITHUB_SHA) {
    return {
      commit: env.GITHUB_SHA.slice(0, SHORT_LENGTH),
      commitFull: env.GITHUB_SHA,
      ref: env.GITHUB_REF_NAME ?? '',
      builtAt,
      builtBy: 'github-actions',
    };
  }

  const full = git(['rev-parse', 'HEAD']);
  if (!full) {
    return { commit: 'unknown', commitFull: '', ref: '', builtAt, builtBy: 'local' };
  }
  const dirty = (git(['status', '--porcelain']) ?? '') !== '';
  return {
    commit: full.slice(0, SHORT_LENGTH) + (dirty ? '-dirty' : ''),
    commitFull: full,
    ref: git(['rev-parse', '--abbrev-ref', 'HEAD']) ?? '',
    builtAt,
    builtBy: 'local',
  };
}

const VIRTUAL_ID = 'virtual:build-info';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

export function buildInfo(): Plugin {
  return {
    name: 'chariot-build-info',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const info = resolveBuildInfo(process.env, runGit);
      this.info(`build info: commit ${info.commit} (${info.builtBy})`);
      return `export default ${JSON.stringify(info)};`;
    },
  };
}
