'use strict';

const { execFile } = require('node:child_process');
const {
  clampPct,
  expandHome,
  failedWindows,
  fetchJson,
  isoBeijing,
  readJson,
} = require('../lib/common.cjs');

function readKeychain(service) {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/security', ['find-generic-password', '-s', service, '-w'], {
      encoding: 'utf8',
      timeout: 10_000,
    }, (error, stdout) => {
      if (error) {
        reject(new Error(error.code === 44 ? `钥匙串中没有 ${service} 条目` : `钥匙串读取失败（${error.code || error.message}）`));
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });
}

async function collectClaude(config = {}) {
  const fetchedAt = isoBeijing();
  if (!config.enabled) {
    return { ...failedWindows('Claude', '未启用', fetchedAt), disabled: true };
  }
  if (config.experimental !== true || config.allowLocalCredentialRead !== true) {
    return failedWindows('Claude', '必须显式开启 experimental 和 allowLocalCredentialRead', fetchedAt);
  }
  try {
    let token = '';
    if (config.keychainService) {
      const raw = await readKeychain(String(config.keychainService));
      try {
        // 新版 Claude Code 在钥匙串里存的是完整凭证 JSON，而不是裸 token
        const parsed = JSON.parse(raw);
        token = String(parsed && parsed.claudeAiOauth && parsed.claudeAiOauth.accessToken || '').trim();
      } catch {
        token = raw;
      }
    } else {
      const credentialsPath = expandHome(config.credentialsFile || '~/.claude/.credentials.json');
      const credentials = readJson(credentialsPath);
      token = String(credentials && credentials.claudeAiOauth && credentials.claudeAiOauth.accessToken || '').trim();
    }
    if (!token) throw new Error('Claude 登录凭据中没有 accessToken');
    const payload = await fetchJson('https://api.anthropic.com/api/oauth/usage', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
        'user-agent': 'kindle-ai-quota-dashboard/0.1',
      },
    });
    const windows = [];
    for (const [key, name] of [['five_hour', '5小时'], ['seven_day', '7天']]) {
      const item = payload && payload[key];
      if (!item) continue;
      const used = Number(item.utilization != null ? item.utilization : item.utilization_pct);
      if (!Number.isFinite(used)) continue;
      windows.push({
        name,
        usedPct: clampPct(used),
        resetAt: isoBeijing(item.resets_at || item.reset_at),
      });
    }
    if (!windows.length) throw new Error('Claude usage 响应中没有可识别的额度窗口');
    return { ok: true, label: 'Claude', windows, fetchedAt, error: null };
  } catch (error) {
    return failedWindows('Claude', error, fetchedAt);
  }
}

module.exports = { collectClaude, readKeychain };
