'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../src/lib/config.cjs');

const ignoredDirs = new Set([
  '.git',
  'dist',
  'history',
  'logs',
  'node_modules',
  'release',
  'state',
]);
const ignoredFiles = new Set(['package-lock.json']);
const forbiddenNames = [
  /^data\.(?:json|js)$/i,
  /\.jsonl$/i,
  /\.log$/i,
  /\.kpkg$/i,
  /^config\.json$/i,
];
const contentPatterns = [
  { label: 'Windows 私人用户目录', regex: /[A-Za-z]:\\Users\\[^\\\r\n]+\\/i },
  { label: 'macOS/Linux 私人用户目录', regex: /\/(?:Users|home)\/[^/\r\n]+\//i },
  { label: '家庭局域网地址', regex: /\b192\.168\.\d{1,3}\.\d{1,3}\b/ },
  { label: 'MAC 地址', regex: /\b[0-9A-F]{2}(?::[0-9A-F]{2}){5}\b/i },
  {
    label: '疑似直接写入的秘密',
    regex: /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\b\s*[:=]\s*["'][A-Za-z0-9_./+=-]{12,}["']/i,
  },
];

function walk(dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(fullPath));
    else if (!ignoredFiles.has(entry.name)) output.push(fullPath);
  }
  return output;
}

// gitignore 覆盖的本地文件（如 config.json）本来就不会进仓库，不参与检查
let ignoredOnDisk = new Set();
try {
  const listed = execFileSync('git', ['ls-files', '--others', '--ignored', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  ignoredOnDisk = new Set(listed.split('\n').filter(Boolean));
} catch {}

const problems = [];
for (const filePath of walk(ROOT)) {
  const relative = path.relative(ROOT, filePath);
  if (ignoredOnDisk.has(relative)) continue;
  if (relative === path.join('scripts', 'check-public.cjs')) continue;
  const inExamples = relative.startsWith(`examples${path.sep}`);
  if (!inExamples && forbiddenNames.some((pattern) => pattern.test(path.basename(filePath)))) {
    problems.push(`${relative}: 不应进入公开仓库的运行产物`);
    continue;
  }
  if (fs.statSync(filePath).size > 2 * 1024 * 1024) {
    problems.push(`${relative}: 文件超过 2 MiB，需人工确认`);
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  for (const item of contentPatterns) {
    if (item.regex.test(content)) problems.push(`${relative}: ${item.label}`);
  }
}

if (problems.length) {
  process.stderr.write(`公开前检查失败：\n- ${problems.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('公开前检查通过：未发现已知私人路径、运行数据或疑似明文秘密。\n');
}
