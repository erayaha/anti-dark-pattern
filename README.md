# Anti-Dark Pattern Linter

Anti-Dark Pattern is a production-oriented GitHub Action and CLI for CI/CD dark-pattern detection in front-end codebases. It scans UI source files for legally risky dark pattern signals and fails pull requests before deceptive flows ship.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)
![ESLint](https://img.shields.io/badge/Linting-ESLint-4B32C3?logo=eslint&logoColor=white)
![Yarn](https://img.shields.io/badge/Package%20Manager-Yarn-2C8EBB?logo=yarn&logoColor=white)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Docs-2563eb?logo=github&logoColor=white)](https://erayaha.github.io/anti-dark-pattern/)

> 🌐 **Live Documentation & Rules**: View the publicly exposed documentation and rule catalog on GitHub Pages at **[erayaha.github.io/anti-dark-pattern](https://erayaha.github.io/anti-dark-pattern/)**.

Use it as a reusable GitHub Action in your own pipelines, or run the CLI directly in a custom workflow.

## Quick start

Add the action to a repository workflow:

```yaml
name: anti-dark-pattern

on:
  pull_request:
  push:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: erayaha/anti-dark-pattern@v1
        with:
          path: src
          format: github
```

Use `@v1` to follow compatible major releases, or pin an exact tag such as `@v1.0.0` for stricter reproducibility.

## What it does

- Scans HTML, JS, JSX, TS, TSX, Vue, Svelte, Astro, Liquid, and MDX files.
- Detects common dark-pattern signals such as:
  - confirm shaming
  - forced continuity
  - hidden costs
  - artificial urgency or scarcity
  - obstructive consent
- Produces human-readable text, JSON, or GitHub annotation output.
- Exits non-zero when violations are found so it can block CI automatically.
- Uses a deterministic heuristic engine by default, while exposing an engine interface that can be backed by any LLM or model provider.
- Ships as a root-level GitHub Action with marketplace metadata so teams can use it directly in workflows.

## Use as a GitHub Action

The action is intended for teams that want to add dark-pattern checks to CI/CD with minimal setup.

### Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `path` | No | `.` | Path to scan for front-end files. |
| `format` | No | `github` | Output format: `text`, `json`, or `github`. |
| `rules` | No | all rules | Comma-separated subset of rule IDs to run. |
| `model` | No | heuristic by omission | Set to `github` to enable GitHub Models-backed analysis. |
| `github_model` | No | GitHub default | Optional GitHub Models model ID override. |

### Outputs

| Output | Description |
| --- | --- |
| `exit_code` | `0` for no findings, `1` when findings are detected, `2` for invalid usage or scan failure. |

Optional GitHub Models analysis:

```yaml
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: erayaha/anti-dark-pattern@v1
        env:
          MODELS_TOKEN: ${{ secrets.MODELS_TOKEN }}
        with:
          path: src
          format: github
          model: github
          github_model: openai/gpt-5-mini
```

To stay compatible with GitHub Marketplace publication requirements, this repository keeps the reusable workflow example in the README instead of shipping workflow files in `.github/workflows`.

## CLI usage

If you want the scanner without the reusable action wrapper, you can run the CLI directly.

## Development setup

```bash
yarn install --frozen-lockfile
yarn lint
yarn typecheck
yarn test
yarn build
```

Build the CLI and scan a project:

```bash
yarn build
node dist/src/index.js ./src
```

Common options:

```bash
node dist/src/index.js ./src --format text
node dist/src/index.js ./src --format json
node dist/src/index.js ./src --format github
MODELS_TOKEN=... node dist/src/index.js ./src --model github
MODELS_TOKEN=... node dist/src/index.js ./src --model github --github-model openai/gpt-5-mini
node dist/src/index.js ./src --rules hidden-costs,obstructive-consent
node dist/src/index.js --list-rules
```

Exit codes:

- `0`: no findings
- `1`: one or more dark-pattern findings
- `2`: invalid CLI usage or scan failure

## Rule catalog

| Rule ID | Purpose |
| --- | --- |
| `confirm-shaming` | Detects guilt-based opt-out copy such as “No thanks, I hate saving money.” |
| `forced-continuity` | Detects auto-renew and post-trial charge messaging that needs compliance review. |
| `hidden-costs` | Detects fee disclosures that appear late in the purchase flow. |
| `countdown-urgency` | Detects countdown, scarcity, and urgency prompts. |
| `obstructive-consent` | Detects hidden reject paths and pre-checked marketing/tracking consent. |

## LLM-ready architecture

The default engine is fully deterministic so tests can run end to end without network access or human review. If you want model-based classification, the CLI now supports GitHub Models directly with `--model github` and a `MODELS_TOKEN` environment variable.

If you want a different provider, implement the `PromptDrivenModel` interface from `/src/engine.ts` and pass a `ModelBackedAnalysisEngine` into `analyzePaths()`.

That design keeps CI reproducible while still supporting GitHub Models, Copilot, OpenAI-compatible endpoints, or any other LLM provider in production environments.

## License

MIT. See `/LICENSE`.

## Automated test coverage

The Vitest suite covers:

- every built-in detection rule
- directory scanning and ignore behavior
- CLI help, JSON, GitHub annotation, and success/error paths
- engine pluggability for external model providers

Coverage thresholds are enforced in `/vitest.config.ts` so regressions fail the test run automatically.
