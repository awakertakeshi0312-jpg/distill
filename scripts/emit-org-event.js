import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const kernelRoot = process.env.AI_ORG_KERNEL_ROOT || path.join(os.homedir(), 'dev', 'active', 'ai-org-kernel');
const kernelScript = path.join(kernelRoot, 'scripts', 'emit-org-event.js');

function readPayloadFile(filePath) {
  const resolvedPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Payload file not found: ${resolvedPath}`);
  }

  return fs.readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, '');
}

function normalizeArgs(argv) {
  const normalized = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--payload-file') {
      if (!next) {
        throw new Error('--payload-file requires a path.');
      }

      normalized.push('--payload', readPayloadFile(next));
      index += 1;
      continue;
    }

    if (token === '--payload' && next?.startsWith('@')) {
      normalized.push('--payload', readPayloadFile(next.slice(1)));
      index += 1;
      continue;
    }

    normalized.push(token);
  }

  return normalized;
}

let args;
try {
  args = ['--project', 'distill', '--source', process.cwd(), ...normalizeArgs(process.argv.slice(2))];
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (!fs.existsSync(kernelScript)) {
  console.error(`AI Org event emitter not found: ${kernelScript}`);
  console.error('Set AI_ORG_KERNEL_ROOT or place ai-org-kernel under ~/dev/active/ai-org-kernel.');
  process.exit(1);
}

let result;
try {
  result = spawnSync(process.execPath, [kernelScript, ...args], { stdio: 'inherit' });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
