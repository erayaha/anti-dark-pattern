import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DARK_PATTERN_RULES, getRuleById, selectRules } from '../src/rules';

function findRule(ruleId: string) {
  const rule = DARK_PATTERN_RULES.find((candidate) => candidate.id === ruleId);
  if (!rule) {
    throw new Error(`Rule ${ruleId} not found in test setup.`);
  }

  return rule;
}

describe('dark pattern rules', () => {
  it('detects confirm shaming language', () => {
    const findings = findRule('confirm-shaming').detect(
      '<button>No thanks, I hate saving money</button>',
      '/tmp/confirm-shaming.html',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(1);
  });

  it('detects forced continuity copy', () => {
    const findings = findRule('forced-continuity').detect(
      '<div>Your subscription renews automatically after the trial ends and you will be charged monthly.</div>',
      '/tmp/forced-continuity.html',
    );

    expect(findings).toHaveLength(2);
    expect(findings.every((finding) => finding.ruleId === 'forced-continuity')).toBe(
      true,
    );
  });

  it('detects hidden fees language', () => {
    const findings = findRule('hidden-costs').detect(
      '<span>Additional charges may apply at checkout, including a service fee.</span>',
      '/tmp/hidden-costs.html',
    );

    expect(findings).toHaveLength(2);
  });

  it('detects countdown urgency patterns', () => {
    const findings = findRule('countdown-urgency').detect(
      '<div>Only 2 spots remaining. Deal ends in 00:05:00.</div>',
      '/tmp/countdown-urgency.html',
    );

    expect(findings).toHaveLength(2);
  });

  it('detects obstructive consent patterns', () => {
    const findings = findRule('obstructive-consent').detect(
      `<button>Accept all</button>
       <button style="display:none">Reject</button>
       <input type="checkbox" name="newsletter" checked />`,
      '/tmp/obstructive-consent.html',
    );

    expect(findings).toHaveLength(2);
    expect(findings.every((finding) => finding.ruleId === 'obstructive-consent')).toBe(
      true,
    );
  });

  it('detects aria-hidden reject paths', () => {
    const findings = findRule('obstructive-consent').detect(
      '<button>Allow all</button><button aria-hidden="true">Decline</button>',
      '/tmp/aria-hidden-consent.html',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('rejection appears hidden');
  });

  it('detects confirm shaming — "no thanks, I don\'t want" variant', () => {
    const findings = findRule('confirm-shaming').detect(
      '<span>No thanks, I don\'t want FREE delivery and other benefits</span>',
      '/tmp/confirm-shaming-want.html',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('confirm-shaming');
  });

  it('detects confirm shaming — cancel and lose all benefits', () => {
    const findings = findRule('confirm-shaming').detect(
      '<span>Cancel membership and lose all benefits</span>',
      '/tmp/confirm-shaming-lose.html',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('confirm-shaming');
  });

  it('detects roach-motel forced survey gate', () => {
    const findings = findRule('roach-motel').detect(
      "<h2>Before you go, tell us why you're leaving</h2>",
      '/tmp/roach-motel.html',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('roach-motel');
    expect(findings[0]?.message).toContain('survey');
  });

  it('detects trick-question read-only pre-checked checkbox', () => {
    const jsxContent = `
      <input
        type="checkbox"
        checked={selectAll}
        readOnly
        style={{ marginRight: 8 }}
      />
    `;
    const findings = findRule('trick-question').detect(jsxContent, '/tmp/trick-question.jsx');

    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('trick-question');
    expect(findings[0]?.message).toContain('read-only');
  });

  it('does not flag interactive (non-readOnly) checkboxes as trick-question', () => {
    const jsxContent = `
      <input
        type="checkbox"
        checked={selectAll}
        onChange={(e) => setSelectAll(e.target.checked)}
        style={{ marginRight: 8 }}
      />
    `;
    const findings = findRule('trick-question').detect(jsxContent, '/tmp/clean-checkbox.jsx');

    expect(findings).toHaveLength(0);
  });

  it('ignores neutral UI copy', () => {
    const findings = DARK_PATTERN_RULES.flatMap((rule) =>
      rule.detect(
        `<div>
           <button>Accept</button>
           <button>Decline</button>
           <p>Price shown includes taxes and shipping.</p>
         </div>`,
        '/tmp/clean.html',
      ),
    );

    expect(findings).toHaveLength(0);
  });

  it('looks up and filters rules by id', () => {
    expect(getRuleById('hidden-costs')?.title).toBe('Hidden cost disclosure');
    expect(selectRules(['hidden-costs']).map((rule) => rule.id)).toEqual(['hidden-costs']);
    expect(selectRules().length).toBe(DARK_PATTERN_RULES.length);
  });

  it('throws when selecting an unknown rule', () => {
    expect(() => selectRules(['does-not-exist'])).toThrow('Unknown rule: does-not-exist');
  });
});

describe('example fixture detection', () => {
  const examplesDir = join(__dirname, '..', 'examples');

  it('flags confirm-shaming and roach-motel in the Amazon Prime Cancellation example', () => {
    const content = readFileSync(
      join(examplesDir, 'amazon-prime-cancellation', 'AmazonPrimeCancellation.jsx'),
      'utf8',
    );

    const confirmShaming = findRule('confirm-shaming').detect(content, 'AmazonPrimeCancellation.jsx');
    const roachMotel = findRule('roach-motel').detect(content, 'AmazonPrimeCancellation.jsx');

    expect(confirmShaming.length).toBeGreaterThanOrEqual(2);
    expect(roachMotel.length).toBeGreaterThanOrEqual(1);
  });

  it('flags trick-question in the LinkedIn Add Connections example', () => {
    const content = readFileSync(
      join(examplesDir, 'linkedin-add-connections', 'LinkedInAddConnections.jsx'),
      'utf8',
    );

    const trickQuestion = findRule('trick-question').detect(content, 'LinkedInAddConnections.jsx');

    expect(trickQuestion.length).toBeGreaterThanOrEqual(1);
  });

  it('detects deceptive patterns in Svelte and Vue template formats', () => {
    const svelteContent = `<script>let autoRenew = true;</script>
      <div>
        <p>Your subscription renews automatically after the trial ends and you will be charged monthly.</p>
        <button on:click={cancel}>Cancel subscription and lose all benefits</button>
      </div>`;

    const findings = DARK_PATTERN_RULES.flatMap((rule) =>
      rule.detect(svelteContent, 'src/components/Plan.svelte'),
    );

    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.some((f) => f.ruleId === 'forced-continuity')).toBe(true);
    expect(findings.some((f) => f.ruleId === 'confirm-shaming')).toBe(true);
  });

  it('detects countdown urgency in Astro and MDX components', () => {
    const astroContent = `---
import Layout from '../layouts/Layout.astro';
---
<div class="banner">
  <span>Offer expires in 10 minutes</span>
  <span>Only 5 spots remaining!</span>
</div>`;

    const findings = findRule('countdown-urgency').detect(astroContent, 'src/pages/checkout.astro');
    expect(findings).toHaveLength(2);
  });
});

