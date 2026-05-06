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
const summary = args.summary || args.title;
if (!summary) {
  console.error('Usage: node scripts/emit-decision-event.js --summary <decision summary> [--path <artifact path>] [--work-packet <id>] [--dry-run]');
  process.exit(1);
}

const payload = {
  decision_summary: summary,
  artifact_path: args.path || undefined,
  privacy: 'summary_only_no_note_body',
};

const result = spawnSync(process.execPath, [
  'scripts/emit-org-event.js',
  '--type', 'decision.created',
  '--summary', summary,
  '--payload-json', JSON.stringify(payload),
  ...(args['work-packet'] ? ['--work-packet', args['work-packet']] : []),
  ...(args['dry-run'] ? ['--dry-run'] : []),
], { stdio: 'inherit' });

process.exit(result.status ?? 1);
