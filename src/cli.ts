import { analyzePaths } from './analyzer';
import { ModelBackedAnalysisEngine } from './engine';
import { GitHubModelsPromptModel } from './github-models';
import { DARK_PATTERN_RULES } from './rules';
import type { AnalysisEngine, ScanSummary } from './types';

export type OutputFormat = 'github' | 'json' | 'text';

export interface CliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

interface ParsedArgs {
  format: OutputFormat;
  model?: 'github';
  githubModel?: string;
  paths: string[];
  ruleIds?: string[];
  showHelp: boolean;
  showVersion: boolean;
  listRules: boolean;
}

const HELP_TEXT = `Usage: anti-dark-pattern [scan] [options] <path ...>

Options:
  --format <text|json|github>  Choose output format (default: text)
  --model <github>             Use an optional AI-backed analysis model
  --github-model <model-id>    Override the GitHub Models model ID
  --rules <id,id>              Restrict analysis to specific rule IDs
  --list-rules                 Print the available rule catalog
  --version, -v                Show version number
  --help                       Show this help message
`;

export async function runCli(
  argv: readonly string[],
  io: CliIo = defaultCliIo(),
): Promise<number> {
  let parsedArgs: ParsedArgs;

  try {
    parsedArgs = parseArgs(argv);
  } catch (error) {
    io.stderr(`${String(error)}\n`);
    io.stderr(HELP_TEXT);
    return 2;
  }

  if (parsedArgs.showHelp) {
    io.stdout(HELP_TEXT);
    return 0;
  }

  if (parsedArgs.showVersion) {
    io.stdout('1.0.0\n');
    return 0;
  }

  if (parsedArgs.listRules) {
    for (const rule of DARK_PATTERN_RULES) {
      io.stdout(`${rule.id}: ${rule.title}\n`);
    }
    return 0;
  }

  try {
    const engine = createAnalysisEngine(parsedArgs);
    const summary = await analyzePaths({
      engine,
      paths: parsedArgs.paths.length > 0 ? parsedArgs.paths : ['.'],
      ruleIds: parsedArgs.ruleIds,
    });

    writeSummary(summary, parsedArgs.format, io);
    return summary.findings.length > 0 ? 1 : 0;
  } catch (error) {
    io.stderr(`${String(error)}\n`);
    return 2;
  }
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsedArgs: ParsedArgs = {
    format: 'text',
    paths: [],
    showHelp: false,
    showVersion: false,
    listRules: false,
  };

  // Strip the optional 'scan' subcommand so that both
  // `anti-dark-pattern <path>` and `anti-dark-pattern scan <path>` work.
  const args = argv[0] === 'scan' ? argv.slice(1) : argv;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--help' || argument === '-h') {
      parsedArgs.showHelp = true;
      continue;
    }

    if (argument === '--version' || argument === '-v') {
      parsedArgs.showVersion = true;
      continue;
    }

    if (argument === '--list-rules') {
      parsedArgs.listRules = true;
      continue;
    }

    if (argument === '--format') {
      index += 1;
      parsedArgs.format = parseFormat(args[index]);
      continue;
    }

    if (argument.startsWith('--format=')) {
      parsedArgs.format = parseFormat(argument.slice('--format='.length));
      continue;
    }

    if (argument === '--model') {
      index += 1;
      parsedArgs.model = parseModel(args[index]);
      continue;
    }

    if (argument.startsWith('--model=')) {
      parsedArgs.model = parseModel(argument.slice('--model='.length));
      continue;
    }

    if (argument === '--github-model') {
      index += 1;
      parsedArgs.githubModel = parseRequiredValue('--github-model', args[index]);
      continue;
    }

    if (argument.startsWith('--github-model=')) {
      parsedArgs.githubModel = parseRequiredValue(
        '--github-model',
        argument.slice('--github-model='.length),
      );
      continue;
    }

    if (argument === '--rules') {
      index += 1;
      parsedArgs.ruleIds = parseRuleIds(args[index]);
      continue;
    }

    if (argument.startsWith('--rules=')) {
      parsedArgs.ruleIds = parseRuleIds(argument.slice('--rules='.length));
      continue;
    }

    if (argument.startsWith('--')) {
      throw new Error(`Unknown option: ${argument}`);
    }

    parsedArgs.paths.push(argument);
  }

  return parsedArgs;
}

function parseFormat(format: string | undefined): OutputFormat {
  if (format === 'text' || format === 'json' || format === 'github') {
    return format;
  }

  throw new Error(`Unsupported format: ${String(format)}`);
}

function parseModel(model: string | undefined): 'github' {
  if (model === 'github') {
    return model;
  }

  throw new Error(`Unsupported model: ${String(model)}`);
}

function parseRuleIds(ruleList: string | undefined): string[] {
  return parseRequiredValue('--rules', ruleList)
    .split(',')
    .map((ruleId) => ruleId.trim())
    .filter(Boolean);
}

function parseRequiredValue(optionName: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${optionName}`);
  }

  return value;
}

function createAnalysisEngine(parsedArgs: ParsedArgs): AnalysisEngine | undefined {
  if (!parsedArgs.model) {
    return undefined;
  }

  const token = process.env.MODELS_TOKEN;
  if (!token) {
    throw new Error('Missing MODELS_TOKEN environment variable for --model github');
  }

  return new ModelBackedAnalysisEngine(
    new GitHubModelsPromptModel({
      token,
      model: parsedArgs.githubModel ?? process.env.GITHUB_MODELS_MODEL,
    }),
  );
}

function writeSummary(summary: ScanSummary, format: OutputFormat, io: CliIo): void {
  if (format === 'json') {
    io.stdout(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  if (format === 'github') {
    if (summary.findings.length === 0) {
      io.stdout(
        `::notice::Scanned ${summary.fileCount} file(s) and found no dark patterns.\n`,
      );
      return;
    }

    for (const finding of summary.findings) {
      io.stdout(
        `::${finding.severity} file=${escapeProperty(finding.filePath)},line=${finding.line},col=${finding.column},title=${escapeProperty(finding.ruleId)}::${escapeMessage(finding.message)} Recommendation: ${escapeMessage(finding.recommendation)}\n`,
      );
    }

    return;
  }

  if (summary.findings.length === 0) {
    io.stdout(`Scanned ${summary.fileCount} file(s) and found no dark patterns.\n`);
    return;
  }

  io.stdout(
    `Scanned ${summary.fileCount} file(s) and found ${summary.findings.length} potential dark pattern(s).\n\n`,
  );

  for (const finding of summary.findings) {
    io.stdout(
      `[${finding.severity}] ${finding.ruleId}\n${finding.filePath}:${finding.line}:${finding.column}\n${finding.message}\nRecommendation: ${finding.recommendation}\nEvidence: ${finding.evidence}\n\n`,
    );
  }
}

function escapeProperty(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function escapeMessage(value: string): string {
  return escapeProperty(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

function defaultCliIo(): CliIo {
  return {
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
  };
}
