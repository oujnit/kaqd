'use strict';

const fs = require('node:fs');
const {
  clampPct,
  expandHome,
  failedWindows,
  fetchJson,
  isoBeijing,
  readJson,
} = require('../lib/common.cjs');

const QUOTA_URL = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit';
const WINDOW_NAMES = ['5小时', '周'];

function readKeyFromConfigFile(config) {
  const filePath = expandHome(config.credentialsFile);
  const doc = readJson(filePath);
  const pointer = String(config.apiKeyPointer || '').split('.').filter(Boolean);
  let value = doc;
  for (const key of pointer) {
    value = value && value[key];
  }
  return String(value || '').trim();
}

async function fetchQuota(key) {
  try {
    return await fetchJson(QUOTA_URL, {
      headers: { Authorization: key, Accept: 'application/json' },
    });
  } catch (error) {
    // 官网监控接口对鉴权头格式存在两种实现，401 时退回 Bearer 形式
    if (!/HTTP 401/.test(String(error && error.message))) throw error;
    return await fetchJson(QUOTA_URL, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
  }
}

async function collectZai(config = {}) {
  const fetchedAt = isoBeijing();
  if (!config.enabled) {
    return { ...failedWindows('GLM', '未启用', fetchedAt), disabled: true };
  }
  if (config.experimental !== true) {
    return failedWindows('GLM', '必须显式开启 experimental', fetchedAt);
  }
  try {
    let key = '';
    const envName = String(config.apiKeyEnv || 'ZAI_API_KEY');
    if (process.env[envName]) {
      key = String(process.env[envName]).trim();
    } else if (config.credentialsFile) {
      if (config.allowLocalCredentialRead !== true) {
        return failedWindows('GLM', '读取本机密钥文件必须显式开启 allowLocalCredentialRead', fetchedAt);
      }
      key = readKeyFromConfigFile(config);
    }
    if (!key) throw new Error(`没有可用的 GLM 密钥（环境变量 ${envName} 或 credentialsFile）`);

    const payload = await fetchQuota(key);
    const limits = Array.isArray(payload && payload.data && payload.data.limits)
      ? payload.data.limits
      : [];
    const tokenLimits = limits
      .filter((item) => item && item.type === 'CREDIT_LIMIT' && Number.isFinite(Number(item.percentage)))
      .sort((a, b) => Number(a.nextResetTime || 0) - Number(b.nextResetTime || 0));
    if (!tokenLimits.length) throw new Error('GLM quota 响应中没有 TOKENS_LIMIT 窗口');

    const windows = tokenLimits.slice(0, WINDOW_NAMES.length).map((item, index) => ({
      name: WINDOW_NAMES[index] || `窗口${index + 1}`,
      usedPct: clampPct(Number(item.percentage)),
      resetAt: item.nextResetTime ? isoBeijing(new Date(Number(item.nextResetTime))) : null,
    }));
    return { ok: true, label: 'GLM', windows, fetchedAt, error: null };
  } catch (error) {
    return failedWindows('GLM', error, fetchedAt);
  }
}

module.exports = { collectZai };
