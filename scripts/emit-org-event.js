import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_KERNEL_URL = 'http://localhost:3001/api/org';
const DEFAULT_SOURCE_PROJECT_ID = 'distill';

function usage() {
  return [
    'Usage:',
    '  node scripts/emit-org-event.js <event.type> --summary <title> [options]',
    '  node scripts/emit-org-event.js --type <event.type> --title <title> [options]',
    '',
    'Options:',
    '  --kernel-url <url>       AI Org Kernel API URL. Default: ORG_API_URL or http://localhost:3001/api/org',
    '  --project <project_id>   Project id. Default: distill',
    '  --source <source>        Event source. Default: current working directory',
    '  --summary <title>        Event title alias used by existing Distill docs',
    '  --title <title>          Event title',
    '  --payload-json <json>    Inline JSON payload',
    '  --payload-file <path>    JSON file payload. UTF-8 BOM is ignored.',
    '  --payload-kv <k=v>       Shallow payload value. Can be repeated.',
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

    if (name === 'dry-run') {
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

  if (args['payload-json']) {
    return JSON.parse(args['payload-json']);
  }

  if (args['payload-file']) {
    return JSON.parse(readPayloadFile(args['payload-file']));
  }

  if (args['payload-kv']) {
    return args['payload-kv'].reduce((payload, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex <= 0) {
        throw new Error(`Invalid --payload-kv value: ${entry}`);
      }

      return {
        ...payload,
        [entry.slice(0, separatorIndex)]: parseScalar(entry.slice(separatorIndex + 1)),
      };
    }, {});
  }

  return {};
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
  const type = args.type ?? args._[0];
  const title = args.title ?? args.summary;

  if (!type || !title) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const kernelUrl = (args['kernel-url'] ?? process.env.ORG_API_URL ?? DEFAULT_KERNEL_URL).replace(/\/$/, '');
  const envelope = {
    type,
    project: args.project ?? DEFAULT_SOURCE_PROJECT_ID,
    source: args.source ?? process.cwd(),
    summary: title,
    payload: {
      ...readPayload(args),
      source_path: process.cwd(),
    },
    artifact_id: args['artifact-id'] ?? undefined,
    work_packet_id: args['work-packet'] ?? undefined,
  };

  if (args['dry-run']) {
    console.log(JSON.stringify({ url: `${kernelUrl}/events`, envelope }, null, 2));
    return;
  }

  console.log(JSON.stringify(await postJson(`${kernelUrl}/events`, envelope), null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
