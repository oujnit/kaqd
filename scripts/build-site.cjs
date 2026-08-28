'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../src/lib/config.cjs');

const webDir = path.join(ROOT, 'web');
const stateDir = path.join(ROOT, 'state');
const distDir = path.join(ROOT, 'dist');
const required = ['index.html', 'dashboard-runtime.js', 'keep-awake.js', 'awake.mp4'];

for (const name of required) {
  const source = path.join(webDir, name);
  if (!fs.existsSync(source)) throw new Error(`缺少网页文件：${source}`);
}
for (const name of ['data.json', 'data.js']) {
  const source = path.join(stateDir, name);
  if (!fs.existsSync(source)) {
    throw new Error(`缺少 ${source}。先运行 npm run demo 或 npm run collect`);
  }
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
for (const name of required) {
  fs.copyFileSync(path.join(webDir, name), path.join(distDir, name));
}
for (const name of ['data.json', 'data.js']) {
  fs.copyFileSync(path.join(stateDir, name), path.join(distDir, name));
}
const endpoint = process.env.DASHBOARD_URL
  ? process.env.DASHBOARD_URL.replace(/\/+$/, '') + '/data.js'
  : 'data.js';
fs.writeFileSync(path.join(distDir, 'live-endpoint.js'),
  `window.DASH_LIVE_ENDPOINT = '${endpoint}';\n`, 'utf8');
fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');

// 部分墨水屏浏览器按文件路径缓存 JS 且无视 ?v= 版本参数，
// 会拿旧脚本配新页面导致页面停在占位状态。
// 把所有会变化的脚本和数据直接内嵌进 index.html，单文件即整页。
const htmlPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const inline = (name, content) => {
  html = html.replace(
    new RegExp('<script src="' + name + '[^"]*"></script>'),
    '<script>\n' + content + '\n</script>',
  );
};
inline('data.js', fs.readFileSync(path.join(distDir, 'data.js'), 'utf8').trim());
inline('live-endpoint.js', fs.readFileSync(path.join(distDir, 'live-endpoint.js'), 'utf8').trim());
inline('dashboard-runtime.js', fs.readFileSync(path.join(distDir, 'dashboard-runtime.js'), 'utf8').trim());
inline('keep-awake.js', fs.readFileSync(path.join(distDir, 'keep-awake.js'), 'utf8').trim());
fs.writeFileSync(htmlPath, html, 'utf8');
process.stdout.write(`built ${distDir}\n`);
