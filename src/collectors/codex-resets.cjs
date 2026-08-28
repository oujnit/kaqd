'use strict';

// codex-resets.com 没有公开 JSON API，但页面是服务端渲染，
// 最新重置时间固定出现在 hero 区的 data-datetime 属性里，直接抓取解析。
const {
  isoBeijing,
} = require('../lib/common.cjs');

const PAGE_URL = 'https://codex-resets.com/';
const REQUEST_TIMEOUT_MS = 15_000;

function extractResetAt(html) {
  const match = html.match(/data-role="relative-time"[^>]*data-datetime="([^"]+)"/);
  if (match) return match[1];
  const fallback = html.match(/data-datetime="([^"]+)"/);
  return fallback ? fallback[1] : '';
}

async function fetchPage() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(PAGE_URL, {
      headers: { Accept: 'text/html', 'User-Agent': 'kindle-quota-dashboard/0.1' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function collectCodexResets() {
  const fetchedAt = isoBeijing();
  try {
    const html = await fetchPage();
    const resetAt = extractResetAt(html);
    const parsed = resetAt ? Date.parse(resetAt) : NaN;
    if (Number.isNaN(parsed)) throw new Error('页面里没有找到最新重置时间');
    return {
      ok: true,
      label: 'Codex Resets',
      resetAt: isoBeijing(parsed),
      sourceUrl: PAGE_URL,
      fetchedAt,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      label: 'Codex Resets',
      resetAt: null,
      sourceUrl: PAGE_URL,
      fetchedAt,
      error: String(error && error.message || error),
    };
  }
}

module.exports = { collectCodexResets };
