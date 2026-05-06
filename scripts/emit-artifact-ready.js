import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.title || !args.path) {
  console.error('Usage: node scripts/emit-artifact-ready.js --title <title> --path <path> [--type <type>] [--summary <summary>] [--work-packet <id>] [--dry-run]');
  process.exit(1);
}

const result = spawnSync(process.execPath, [
  'scripts/register-org-artifact.js',
  '--title', args.title,
  '--path', args.path,
  '--type', args.type || args.kind || 'project_doc',
  '--summary', args.summary || 'Distill artifact ready. Private note bodies are not included.',
  ...(args['work-packet'] ? ['--work-packet', args['work-packet']] : []),
  ...(args['dry-run'] ? ['--dry-run'] : []),
], { stdio: 'inherit' });

process.exit(result.status ?? 1);
