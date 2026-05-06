import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_KERNEL_ROOT = path.join(os.homedir(), 'dev', 'active', 'ai-org-kernel');
const DEFAULT_OUT_JSON = 'docs/distill_personal_km_handoff.json';
const DEFAULT_OUT_MD = 'docs/distill_personal_km_handoff.md';
const WORK_PACKET_ID = 'wp_20260506_connect-distill-reviewed-artifacts-to-personal-km';
const HANDOFF_EVENT_TYPES = new Set(['decision.created', 'artifact.ready', 'memory.save_requested']);
const PRIVATE_KEY_PATTERN = /(body|content|text|raw|vault|passphrase|password|secret|token|credential|export|private)/i;
const OMIT_KEY_PATTERN = /^(source_path|absolute_path)$/i;

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

function kernelRoot(args) {
  return args['kernel-root'] || process.env.AI_ORG_KERNEL_ROOT || DEFAULT_KERNEL_ROOT;
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function compact(value, max = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function safeScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function sanitizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => !PRIVATE_KEY_PATTERN.test(key) && !OMIT_KEY_PATTERN.test(key) && safeScalar(item))
      .map(([key, item]) => [key, item]),
  );
}

function eventKind(type) {
  if (type === 'decision.created') return 'reviewed_decision';
  if (type === 'artifact.ready') return 'ready_artifact';
  return 'memory_save_candidate';
}

function buildEventHandoff(event) {
  const summary = compact(event.summary);
  const payload = sanitizeObject(event.payload);
  return {
    id: `distill_event_${hash(event.id || `${event.timestamp}:${summary}`)}`,
    source: 'ai_org_event',
    source_id: event.id,
    source_ref: `ai-org://event/${event.id}`,
    kind: eventKind(event.type),
    title: summary || event.type,
    summary,
    created_at: event.timestamp || null,
    project: 'distill',
    tags: ['distill', 'ai-org', event.type],
    metadata: {
      event_type: event.type,
      ...payload,
    },
    personal_km_target: {
      route: 'POST /api/review',
      status: 'new',
      artifact_type: 'distill_handoff',
    },
    privacy: 'summary_only_no_note_body',
  };
}

function buildArtifactHandoff(artifact) {
  const summary = compact(artifact.summary || artifact.title);
  return {
    id: `distill_artifact_${hash(artifact.id || artifact.uri || artifact.title)}`,
    source: 'artifact_registry',
    source_id: artifact.id,
    source_ref: `ai-org://artifact/${artifact.id}`,
    kind: 'registered_artifact',
    title: compact(artifact.title) || artifact.type,
    summary,
    created_at: artifact.created_at || null,
    project: 'distill',
    tags: ['distill', 'artifact', artifact.type].filter(Boolean),
    metadata: {
      artifact_type: artifact.type,
      uri: artifact.uri,
      status: artifact.metadata?.status,
      work_packet_id: artifact.metadata?.work_packet_id,
    },
    personal_km_target: {
      route: 'POST /api/review',
      status: 'new',
      artifact_type: 'distill_handoff',
    },
    privacy: 'summary_only_no_note_body',
  };
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildManifest(root, args) {
  const limit = Number(args.limit || 50);
  const events = readJsonl(path.join(root, 'backend', 'org', 'event-bus', 'events.jsonl'))
    .filter((event) => event.project === 'distill' && HANDOFF_EVENT_TYPES.has(event.type))
    .slice(-limit)
    .reverse()
    .map(buildEventHandoff);

  const artifacts = readJsonl(path.join(root, 'backend', 'org', 'artifact-registry', 'artifacts.jsonl'))
    .filter((artifact) => artifact.project === 'distill')
    .slice(-limit)
    .reverse()
    .map(buildArtifactHandoff);

  const records = uniqueById([...events, ...artifacts]);
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source_project: 'distill',
    target_project: 'personal-km',
    work_packet_id: WORK_PACKET_ID,
    privacy: {
      mode: 'summary_only_no_note_body',
      omitted_keys_matching: PRIVATE_KEY_PATTERN.source,
    },
    personal_km_ingestion: {
      preferred_route: 'POST /api/review',
      fallback_file: DEFAULT_OUT_JSON,
      review_item_shape: {
        title: '<record.title>',
        body: '<record.summary>\\nSource: <record.source_ref>',
        tags: ['distill', 'handoff', '<record.kind>'],
        source_refs: ['<record.source_ref>'],
      },
    },
    record_count: records.length,
    records,
  };
}

function renderMarkdown(manifest) {
  const lines = [
    '# Distill to Personal KM Handoff',
    '',
    `Generated: ${manifest.generated_at}`,
    '',
    '## Purpose',
    '',
    'This file is a summary-only handoff manifest for moving reviewed Distill decisions and ready artifacts into Personal KM without copying private note bodies.',
    '',
    '## Personal KM Target',
    '',
    'Preferred ingestion target:',
    '',
    '```text',
    'POST /api/review',
    '```',
    '',
    'Review item body should contain only the handoff summary and source reference. Raw Distill note content, vault payloads, exports, passphrases, secrets, and credential values must not be copied.',
    '',
    'Machine-readable fallback file:',
    '',
    '```text',
    'docs/distill_personal_km_handoff.json',
    '```',
    '',
    '## Privacy Boundary',
    '',
    `Mode: \`${manifest.privacy.mode}\``,
    '',
    'The exporter drops private-looking keys and keeps only scalar summary metadata. Record IDs, counts, states, tags, artifact types, and AI Org source references are allowed.',
    '',
    '## Records',
    '',
    '| ID | Kind | Source | Title |',
    '| --- | --- | --- | --- |',
    ...manifest.records.map((record) =>
      `| \`${record.id}\` | ${record.kind} | \`${record.source_ref}\` | ${record.title.replace(/\|/g, '/')} |`,
    ),
    '',
    '## Verification',
    '',
    '```powershell',
    'node --check scripts/export-personal-km-handoff.js',
    'npm run org:handoff',
    'npm test',
    'npm run build',
    '```',
    '',
    'Associated Work Packet:',
    '',
    '```text',
    WORK_PACKET_ID,
    '```',
  ];
  return `${lines.join('\n')}\n`;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), filePath)), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

const args = parseArgs(process.argv.slice(2));
const root = kernelRoot(args);
const manifest = buildManifest(root, args);
const outJson = args['out-json'] || DEFAULT_OUT_JSON;
const outMd = args['out-md'] || DEFAULT_OUT_MD;

if (args['dry-run']) {
  console.log(JSON.stringify(manifest, null, 2));
} else {
  writeFile(outJson, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(outMd, renderMarkdown(manifest));
  console.log(`handoff.exported ${manifest.record_count} records -> ${outJson}, ${outMd}`);
}
