import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_LOCAL_API_URL = 'http://localhost:3001/api/org';
const DEFAULT_PROJECT_ID = 'distill';

function usage() {
  return [
    'Usage:',
    '  node scripts/register-org-artifact.js --title <title> --path <path> [options]',
    '',
    'Options:',
    '  --kernel-root <path>      AI Org Kernel root. Default: AI_ORG_KERNEL_ROOT or ~/dev/active/ai-org-kernel',
    '  --local-api               Post to Personal KM local API instead of central Kernel files',
    '  --kernel-url <url>        Local API URL when --local-api is used',
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
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const next = argv[index + 1];
    if (name === 'dry-run' || name === 'local-api') {
      args[name] = true;
      continue;
    }
    if (!next || next.startsWith('--')) throw new Error(`Missing value for --${name}`);
    args[name] = next;
    index += 1;
  }
  return args;
}

function kernelRoot(args) {
  return args['kernel-root'] || process.env.AI_ORG_KERNEL_ROOT || path.join(os.homedir(), 'dev', 'active', 'ai-org-kernel');
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`AI Org API returned ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function registerToLocalApi(args, artifact) {
  const kernelUrl = (args['kernel-url'] ?? process.env.ORG_API_URL ?? DEFAULT_LOCAL_API_URL).replace(/\/$/, '');
  if (args['dry-run']) {
    console.log(JSON.stringify({ url: `${kernelUrl}/artifacts`, artifact }, null, 2));
    return;
  }
  console.log(JSON.stringify(await postJson(`${kernelUrl}/artifacts`, artifact), null, 2));
}

function registerToCentralKernel(args, artifact) {
  const script = path.join(kernelRoot(args), 'scripts', 'register-artifact.js');
  if (!fs.existsSync(script)) {
    throw new Error(`Central Kernel artifact script not found: ${script}`);
  }
  const result = spawnSync(process.execPath, [
    script,
    '--project', artifact.project,
    '--type', artifact.type,
    '--title', artifact.title,
    '--uri', artifact.uri,
    '--summary', artifact.summary,
    '--metadata', JSON.stringify(artifact.metadata),
    ...(args['dry-run'] ? ['--dry-run'] : []),
  ], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
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
  const relativePath = path.relative(process.cwd(), artifactPath);
  const uri = relativePath && !relativePath.startsWith('..') ? relativePath.replace(/\\/g, '/') : artifactPath;
  const artifact = {
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
  if (args['local-api']) {
    await registerToLocalApi(args, artifact);
  } else {
    registerToCentralKernel(args, artifact);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
