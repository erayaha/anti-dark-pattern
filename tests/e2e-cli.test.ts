import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLI_PATH = join(__dirname, '..', 'dist', 'src', 'index.js');
const TEMP_TEST_DIR = join(__dirname, '..', 'tmp-e2e-fixtures');

beforeAll(() => {
  if (existsSync(TEMP_TEST_DIR)) {
    rmSync(TEMP_TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEMP_TEST_DIR, { recursive: true });

  // Clean fixture
  writeFileSync(
    join(TEMP_TEST_DIR, 'clean.html'),
    `<div>
      <h2>Transparent Checkout</h2>
      <p>All taxes and shipping are calculated upfront: $25.00 total.</p>
      <button>Place Order</button>
      <button>Cancel</button>
    </div>`,
  );

  // Dirty confirm-shaming & urgency fixture
  writeFileSync(
    join(TEMP_TEST_DIR, 'dirty.html'),
    `<div>
      <p>Only 3 spots left! Deal ends in 00:02:00</p>
      <button>Accept Offer</button>
      <button>No thanks, I hate saving money</button>
    </div>`,
  );
});

afterAll(() => {
  if (existsSync(TEMP_TEST_DIR)) {
    rmSync(TEMP_TEST_DIR, { recursive: true, force: true });
  }
});

interface CliExecError {
  stdout?: Buffer | string;
  stderr?: Buffer | string;
  status?: number;
}

function runCli(args: string[], options: { expectFail?: boolean } = {}) {
  const cmd = `node "${CLI_PATH}" ${args.join(' ')}`;
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (error: unknown) {
    if (options.expectFail) {
      const err = error as CliExecError;
      return {
        stdout: err.stdout?.toString() ?? '',
        stderr: err.stderr?.toString() ?? '',
        status: err.status ?? 1,
      };
    }
    throw error;
  }
}

describe('Anti-Dark Pattern CLI E2E', () => {
  it('displays help text with --help', () => {
    const res = runCli(['--help']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('anti-dark-pattern');
    expect(res.stdout).toContain('Usage:');
    expect(res.stdout).toContain('--format');
    expect(res.stdout).toContain('--rules');
  });

  it('displays version number with --version', () => {
    const res = runCli(['--version']);
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('lists all available detection rules with --list-rules', () => {
    const res = runCli(['--list-rules']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('confirm-shaming');
    expect(res.stdout).toContain('forced-continuity');
    expect(res.stdout).toContain('hidden-costs');
    expect(res.stdout).toContain('countdown-urgency');
    expect(res.stdout).toContain('roach-motel');
    expect(res.stdout).toContain('trick-question');
    expect(res.stdout).toContain('obstructive-consent');
  });

  it('exits 0 on a clean front-end codebase', () => {
    const cleanFile = join(TEMP_TEST_DIR, 'clean.html');
    const res = runCli([`"${cleanFile}"`, '--format', 'text']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('found no dark patterns');
  });

  it('exits 1 on code with dark patterns', () => {
    const dirtyFile = join(TEMP_TEST_DIR, 'dirty.html');
    const res = runCli([`"${dirtyFile}"`, '--format', 'text'], { expectFail: true });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('confirm-shaming');
    expect(res.stdout).toContain('countdown-urgency');
    expect(res.stdout).toContain('potential dark pattern(s)');
  });

  interface JsonFinding {
    ruleId: string;
    filePath: string;
    line: number;
    column: number;
    message: string;
    recommendation: string;
    evidence: string;
  }

  interface JsonScanSummary {
    fileCount: number;
    findings: JsonFinding[];
  }

  it('produces valid JSON output with --format json', () => {
    const dirtyFile = join(TEMP_TEST_DIR, 'dirty.html');
    const res = runCli([`"${dirtyFile}"`, '--format', 'json'], { expectFail: true });
    expect(res.status).toBe(1);
    const parsed = JSON.parse(res.stdout) as JsonScanSummary;
    expect(parsed.fileCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(parsed.findings.length).toBeGreaterThanOrEqual(2);
    expect(parsed.findings[0]).toHaveProperty('ruleId');
    expect(parsed.findings[0]).toHaveProperty('filePath');
    expect(parsed.findings[0]).toHaveProperty('line');
    expect(parsed.findings[0]).toHaveProperty('message');
  });

  it('produces GitHub Actions workflow annotations with --format github', () => {
    const dirtyFile = join(TEMP_TEST_DIR, 'dirty.html');
    const res = runCli([`"${dirtyFile}"`, '--format', 'github'], { expectFail: true });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('::error file=');
    expect(res.stdout).toContain('title=');
  });

  it('filters rules using --rules flag', () => {
    const dirtyFile = join(TEMP_TEST_DIR, 'dirty.html');
    const res = runCli([`"${dirtyFile}"`, '--rules', 'confirm-shaming', '--format', 'json'], {
      expectFail: true,
    });
    expect(res.status).toBe(1);
    const parsed = JSON.parse(res.stdout) as JsonScanSummary;
    expect(parsed.findings.every((f) => f.ruleId === 'confirm-shaming')).toBe(true);
  });

  it('scans built-in examples/amazon-prime-cancellation and exits 1', () => {
    const examplePath = join(__dirname, '..', 'examples', 'amazon-prime-cancellation');
    const res = runCli([`"${examplePath}"`, '--format', 'json'], { expectFail: true });
    expect(res.status).toBe(1);
    const parsed = JSON.parse(res.stdout) as JsonScanSummary;
    const ruleIds = parsed.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('confirm-shaming');
    expect(ruleIds).toContain('roach-motel');
  });

  it('scans built-in examples/linkedin-add-connections and exits 1', () => {
    const examplePath = join(__dirname, '..', 'examples', 'linkedin-add-connections');
    const res = runCli([`"${examplePath}"`, '--format', 'json'], { expectFail: true });
    expect(res.status).toBe(1);
    const parsed = JSON.parse(res.stdout) as JsonScanSummary;
    const ruleIds = parsed.findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('trick-question');
  });

  it('exits 2 on invalid rules', () => {
    const cleanFile = join(TEMP_TEST_DIR, 'clean.html');
    const res = runCli([`"${cleanFile}"`, '--rules', 'non-existent-rule'], {
      expectFail: true,
    });
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Unknown rule: non-existent-rule');
  });

  it('exits 2 on non-existent path', () => {
    const res = runCli(['/path/that/does/not/exist/anywhere'], { expectFail: true });
    expect(res.status).toBe(2);
  });
});
