import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_KERNEL_URL = 'http://localhost:3001/api/org';
const DEFAULT_PROJECT_ID = 'distill';

function usage() {
  return [
    'Usage:',
    '  node scripts/register-org-artifact.js --title <title> --path <path> [options]',
    '',
    'Options:',
    '  --kernel-url <url>        AI Org Kernel API URL. Default: ORG_API_URL or http://localhost:3001/api/org',
    '  --project <project_id>    Project id. Default: distill',
    '  --work-packet <id>        Related Work Packet id',
    '  --type <type>             project_doc | code | test | report | release | config | dataset | workflow. Default: project_doc',
    '  --kind <kind>             Alias for --type',
    '  --summary <summary>       Artifact summary',
    '  --status <status>         Artifact status. Default: ready',
    '  --dry-run                 Print the outgoing payload without posting it.',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const name = token.slice(2);
    const next = argv[index + 1];

    if (name === 'dry-run') {
      args[name] = true;
      continue;
    }

    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }

    args[name] = next;
    index += 1;
  }

  return args;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`AI Org Kernel returned ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.title || !args.path) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const artifactPath = path.resolve(process.cwd(), args.path);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact path does not exist: ${artifactPath}`);
  }

  const kernelUrl = (args['kernel-url'] ?? process.env.ORG_API_URL ?? DEFAULT_KERNEL_URL).replace(/\/$/, '');
  const relativePath = path.relative(process.cwd(), artifactPath);
  const uri = relativePath && !relativePath.startsWith('..') ? relativePath.replace(/\\/g, '/') : artifactPath;
  const payload = {
    project: args.project ?? DEFAULT_PROJECT_ID,
    type: args.type ?? args.kind ?? 'project_doc',
    title: args.title,
    uri,
    summary: args.summary ?? '',
    metadata: {
      absolute_path: artifactPath,
      work_packet_id: args['work-packet'] ?? undefined,
      status: args.status ?? 'ready',
    },
  };

  if (args['dry-run']) {
    console.log(JSON.stringify({ url: `${kernelUrl}/artifacts`, artifact: payload }, null, 2));
    return;
  }

  console.log(JSON.stringify(await postJson(`${kernelUrl}/artifacts`, payload), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
