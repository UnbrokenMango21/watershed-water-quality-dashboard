// Local MCP adapter for the installed Firebase CLI. No credentials are stored here.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const allowed = new Set([
  'firebase_get_environment',
  'firebase_get_project',
  'firebase_list_apps',
  'firebase_get_security_rules',
  'firebase_validate_security_rules',
  'functions_list_functions',
  'apphosting_list_backends',
]);
const root = fileURLToPath(new URL('..', import.meta.url));
const child = spawn('firebase', ['mcp', '--dir', root, '--only', 'core,functions,apphosting'], {
  cwd: root,
  env: process.env,
  stdio: ['pipe', 'pipe', 'inherit'],
});
const pending = new Map();
let nextId = 1;
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const error = (id, message) => send({ jsonrpc: '2.0', id, error: { code: -32601, message } });
createInterface({ input: process.stdin }).on('line', (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.method === 'tools/call' && !allowed.has(message.params?.name)) {
    if (message.id !== undefined) error(message.id, 'Firebase tool is not exposed by this project');
    return;
  }
  if (message.id !== undefined) {
    const originalId = message.id;
    message.id = nextId++;
    pending.set(message.id, { originalId, method: message.method });
  }
  child.stdin.write(`${JSON.stringify(message)}\n`);
});
createInterface({ input: child.stdout }).on('line', (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id !== undefined) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    message.id = request.originalId;
    if (request.method === 'tools/list' && Array.isArray(message.result?.tools)) {
      message.result.tools = message.result.tools.filter((tool) => allowed.has(tool.name));
    }
    if (request.method === 'prompts/list' && Array.isArray(message.result?.prompts)) {
      message.result.prompts = [];
    }
  }
  send(message);
});
child.on('error', (cause) => {
  process.stderr.write(`Firebase MCP could not start: ${cause.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
process.stdin.on('end', () => child.stdin.end());
