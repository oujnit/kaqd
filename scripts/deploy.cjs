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
run('git', ['-C', workDir, 'remote', 'add', 'origin', 'https://github.com/oujnit/kaqd.git']);
run('git', ['-C', workDir, 'push', '-qf', 'origin', 'gh-pages']);

fs.rmSync(workDir, { recursive: true, force: true });

// 这个仓库的 Pages 不会随 gh-pages 推送自动构建，需要 API 触发；
// 触发失败不阻塞，分支内容已更新，下一轮定时任务会重试
try {
  run('gh', ['api', '-X', 'POST', 'repos/oujnit/kaqd/pages/builds']);
} catch (error) {
  process.stderr.write('Pages 构建触发失败（gh-pages 已更新，等待下一轮重试）：\n');
}

process.stdout.write('deployed to GitHub Pages\n');
