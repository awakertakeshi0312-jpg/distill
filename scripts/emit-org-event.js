import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_LOCAL_API_URL = 'http://localhost:3001/api/org';
const DEFAULT_PROJECT_ID = 'distill';

function usage() {
  return [
    'Usage:',
    '  node scripts/emit-org-event.js <event.type> --summary <title> [options]',
    '  node scripts/emit-org-event.js --type <event.type> --title <title> [options]',
    '',
    'Options:',
    '  --kernel-root <path>     AI Org Kernel root. Default: AI_ORG_KERNEL_ROOT or ~/dev/active/ai-org-kernel',
    '  --local-api              Post to Personal KM local API instead of central Kernel files',
    '  --kernel-url <url>       Local API URL when --local-api is used',
    '  --project <project_id>   Project id. Default: distill',
    '  --source <source>        Event source. Default: current working directory',
    '  --summary <title>        Event title alias used by existing Distill docs',
    '  --title <title>          Event title',
    '  --payload-json <json>    Inline JSON payload',
    '  --payload-file <path>    JSON file payload. UTF-8 BOM is ignored.',
    '  --payload-kv <k=v>       Shallow payload value. Can be repeated.',
    '  --work-packet <id>       Related Work Packet id',
    '  --artifact-id <id>       Related Artifact id',
    '  --dry-run                Print the outgoing envelope without posting it.',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const name = token.slice(2);
    const next = argv[index + 1];
    if (name === 'dry-run' || name === 'local-api') {
      args[name] = true;
      continue;
    }
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    if (name === 'payload-kv') {
      args[name] = [...(args[name] ?? []), next];
    } else {
      args[name] = next;
    }
    index += 1;
  }
  return args;
}

function parseScalar(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function readPayloadFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Payload file not found: ${resolvedPath}`);
  }
  return fs.readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, '');
}

function readPayload(args) {
  const payloadSourceCount = [args['payload-json'], args['payload-file'], args['payload-kv']].filter(Boolean).length;
  if (payloadSourceCount > 1) {
    throw new Error('Use only one payload source: --payload-json, --payload-file, or --payload-kv');
  }
  if (args['payload-json']) return JSON.parse(args['payload-json']);
  if (args['payload-file']) return JSON.parse(readPayloadFile(args['payload-file']));
  if (args['payload-kv']) {
    return args['payload-kv'].reduce((payload, entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0) throw new Error(`Invalid --payload-kv value: ${entry}`);
      return { ...payload, [entry.slice(0, separatorIndex)]: parseScalar(entry.slice(separatorIndex + 1)) };
    }, {});
  }
  return {};
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

async function emitToLocalApi(args, type, title, payload) {
  const kernelUrl = (args['kernel-url'] ?? process.env.ORG_API_URL ?? DEFAULT_LOCAL_API_URL).replace(/\/$/, '');
  const envelope = {
    type,
    project: args.project ?? DEFAULT_PROJECT_ID,
    source: args.source ?? process.cwd(),
    summary: title,
    payload,
    artifact_id: args['artifact-id'] ?? undefined,
    work_packet_id: args['work-packet'] ?? undefined,
  };
  if (args['dry-run']) {
    console.log(JSON.stringify({ url: `${kernelUrl}/events`, envelope }, null, 2));
    return;
  }
  console.log(JSON.stringify(await postJson(`${kernelUrl}/events`, envelope), null, 2));
}

function emitToCentralKernel(args, type, title, payload) {
  const script = path.join(kernelRoot(args), 'scripts', 'emit-org-event.js');
  if (!fs.existsSync(script)) {
    throw new Error(`Central Kernel event script not found: ${script}`);
  }
  const normalizedPayload = {
    ...payload,
    source_path: process.cwd(),
    artifact_id: args['artifact-id'] ?? undefined,
    work_packet_id: args['work-packet'] ?? undefined,
  };
  const result = spawnSync(process.execPath, [
    script,
    '--type', type,
    '--project', args.project ?? DEFAULT_PROJECT_ID,
    '--source', args.source ?? process.cwd(),
    '--summary', title,
    '--payload', JSON.stringify(normalizedPayload),
    ...(args['dry-run'] ? ['--dry-run'] : []),
  ], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const type = args.type ?? args._[0];
  const title = args.title ?? args.summary;
  if (!type || !title) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  const payload = readPayload(args);
  if (args['local-api']) {
    await emitToLocalApi(args, type, title, payload);
  } else {
    emitToCentralKernel(args, type, title, payload);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
