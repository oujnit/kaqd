'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT } = require('../src/lib/config.cjs');

const distDir = path.join(ROOT, 'dist');
const workDir = path.join(os.tmpdir(), 'kindle-quota-gh-pages');

function run(command, args, options = {}) {
  execFileSync(command, args, { encoding: 'utf8', ...options });
}

// 天气先行：失败不阻塞额度发布，采集器会保留上一次天气
try {
  run(process.execPath, [path.join(ROOT, 'scripts', 'fetch-weather.cjs')]);
} catch (error) {
  process.stderr.write('天气获取失败，使用旧数据继续：\n');
}
run(process.execPath, [path.join(ROOT, 'src', 'collect.cjs')]);
run(process.execPath, [path.join(ROOT, 'scripts', 'build-site.cjs')]);

fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });
fs.cpSync(distDir, workDir, { recursive: true });

run('git', ['-C', workDir, 'init', '-q', '-b', 'gh-pages']);
run('git', ['-C', workDir, 'add', '-A']);
run('git', ['-C', workDir, '-c', 'user.name=deploy', '-c', 'user.email=deploy@localhost', 'commit', '-qm', `publish dist ${new Date().toISOString()}`]);
run('git', ['-C', workDir, 'remote', 'add', 'origin', 'https://github.com/oujnit/kindle-ai-quota-dashboard.git']);
run('git', ['-C', workDir, 'push', '-qf', 'origin', 'gh-pages']);

fs.rmSync(workDir, { recursive: true, force: true });
process.stdout.write(`deployed to https://oujnit.github.io/kindle-ai-quota-dashboard/\n`);
