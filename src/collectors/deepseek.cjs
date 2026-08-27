'use strict';

const fs = require('node:fs');
const { expandHome } = require('../lib/common.cjs');
const {
  failedBalance,
  fetchJson,
  isoBeijing,
  round1,
} = require('../lib/common.cjs');

function resolveKey(config) {
  const envName = String(config.apiKeyEnv || 'DEEPSEEK_API_KEY');
  if (process.env[envName]) return String(process.env[envName]).trim();
  if (config.credentialsFile) {
    if (config.allowLocalCredentialRead !== true) {
      throw new Error('读取本机密钥文件必须显式开启 allowLocalCredentialRead');
    }
    const filePath = expandHome(String(config.credentialsFile));
    const value = fs.readFileSync(filePath, 'utf8').trim();
    if (value) return value;
    throw new Error('密钥文件为空：' + filePath);
  }
  return '';
}

async function collectDeepSeek(config = {}) {
  const fetchedAt = isoBeijing();
  if (!config.enabled) {
    return { ...failedBalance('DeepSeek', '未启用', fetchedAt), disabled: true };
  }
  let key = '';
  try {
    key = resolveKey(config);
  } catch (error) {
    return failedBalance('DeepSeek', error, fetchedAt);
  }
  if (!key) {
    return failedBalance('DeepSeek', '没有设置环境变量 ' + (config.apiKeyEnv || 'DEEPSEEK_API_KEY') + '，也没有 credentialsFile', fetchedAt);
  }
  try {
    const payload = await fetchJson('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    const rows = Array.isArray(payload && payload.balance_infos) ? payload.balance_infos : [];
    const row = rows.find((item) => item && item.currency === 'CNY') || rows[0];
    const balance = Number(row && row.total_balance);
    if (!Number.isFinite(balance)) throw new Error('余额响应缺少 total_balance');
    const currency = String(row.currency || 'CNY');
    return {
      ok: true,
      label: 'DeepSeek',
      balance: round1(balance * 100) / 100,
      currency,
      detail: `余额 ${currency === 'CNY' ? '¥' : `${currency} `}${balance.toFixed(2)}`,
      fetchedAt,
      error: null,
    };
  } catch (error) {
    return failedBalance('DeepSeek', error, fetchedAt);
  }
}

module.exports = { collectDeepSeek };
