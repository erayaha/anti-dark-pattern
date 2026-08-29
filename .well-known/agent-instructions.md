# Agent Instructions — Anti-Dark Pattern Linter

## When to use this

Use Anti-Dark Pattern when:
- You need automated CI/CD gating against deceptive design patterns, confirm-shaming, roach motels, hidden costs, or forced continuity in pull requests.
- You are auditing front-end codebases (React, JSX, TSX, Vue, Svelte, HTML, MDX, Astro) for compliance with FTC 16 CFR Part 425 ("Click to Cancel") and EU Digital Services Act (DSA Article 25).
- You want deterministic offline linting with structured JSON, text, or GitHub Action annotation outputs.
- You want an AI-extensible model-backed UX analysis engine to evaluate complex UI flows.

## Best-fit use cases

1. **Pull Request Compliance Gate**: Run `anti-dark` on every pull request to detect deceptive subscription cancellations, pre-checked checkboxes, and countdown timer manipulations.
2. **Regulatory UX Audit**: Scan legacy front-end code repositories for legal risk and generate remediation advice.
3. **Design System Linting**: Verify that component libraries adhere to ethical, neutral choice architecture.
