import { describe, expect, it } from 'vitest';
import { resolveBuildInfo, runGit, type GitRunner } from './build-info';

const NOW = new Date('2026-11-22T12:00:00Z');
const SHA = '0123456789abcdef0123456789abcdef01234567';

function fakeGit(answers: Record<string, string | undefined>): GitRunner {
  return (args) => answers[args.join(' ')];
}

describe('resolveBuildInfo', () => {
  it('uses the GitHub Actions commit when present', () => {
    const info = resolveBuildInfo({ GITHUB_SHA: SHA, GITHUB_REF_NAME: 'main' }, fakeGit({}), NOW);
    expect(info).toEqual({
      commit: '0123456',
      commitFull: SHA,
      ref: 'main',
      builtAt: '2026-11-22T12:00:00.000Z',
      builtBy: 'github-actions',
    });
  });

  it('asks git for a clean local build', () => {
    const git = fakeGit({
      'rev-parse HEAD': SHA,
      'status --porcelain': '',
      'rev-parse --abbrev-ref HEAD': 'feature',
    });
    expect(resolveBuildInfo({}, git, NOW)).toMatchObject({
      commit: '0123456',
      ref: 'feature',
      builtBy: 'local',
    });
  });

  it('marks local builds with uncommitted changes as dirty', () => {
    const git = fakeGit({ 'rev-parse HEAD': SHA, 'status --porcelain': ' M src/main.ts' });
    expect(resolveBuildInfo({}, git, NOW).commit).toBe('0123456-dirty');
  });

  it('reports an unknown commit outside a git checkout', () => {
    expect(resolveBuildInfo({}, fakeGit({}), NOW)).toMatchObject({
      commit: 'unknown',
      commitFull: '',
    });
  });
});

describe('runGit', () => {
  it('returns undefined when git fails', () => {
    expect(runGit(['definitely-not-a-git-command'])).toBeUndefined();
  });

  it('reads this checkout', () => {
    expect(runGit(['rev-parse', 'HEAD'])).toMatch(/^[0-9a-f]{40}$/);
  });
});
