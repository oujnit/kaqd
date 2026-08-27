'use strict';

// 从 Open-Meteo 抓取深圳实时天气，写入 config/weather.json 供采集器读取。
// 免费接口，无需 API key；坐标固定，避免每次运行再做地理编码。
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../src/lib/config.cjs');

const PLACE = '深圳';
const LATITUDE = 22.5455;
const LONGITUDE = 114.0683;
const OUTPUT = path.join(ROOT, 'config', 'weather.json');

const WMO = [
  { codes: [0], text: '晴', icon: 'clear' },
  { codes: [1], text: '基本晴', icon: 'clear' },
  { codes: [2], text: '多云', icon: 'cloudy' },
  { codes: [3], text: '阴', icon: 'overcast' },
  { codes: [45, 48], text: '雾', icon: 'fog' },
  { codes: [51, 53, 55, 56, 57], text: '毛毛雨', icon: 'rain' },
  { codes: [61, 63, 65, 66, 67], text: '雨', icon: 'rain' },
  { codes: [71, 73, 75, 77, 85, 86], text: '雪', icon: 'snow' },
  { codes: [80, 81, 82], text: '阵雨', icon: 'rain' },
  { codes: [95, 96, 99], text: '雷阵雨', icon: 'thunder' },
];

const COMPASS = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风'];

function windDir(degrees) {
  const value = Number(degrees);
  if (!Number.isFinite(value)) return '';
  return COMPASS[Math.round(((value % 360) + 360) % 360 / 45) % 8];
}

async function main() {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + LATITUDE
    + '&longitude=' + LONGITUDE
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code'
    + '&timezone=Asia%2FShanghai';
  const response = await fetch(url);
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const payload = await response.json();
  const current = payload.current || {};
  const matched = WMO.find((entry) => entry.codes.includes(Number(current.weather_code)))
    || { text: '天气', icon: 'cloudy' };

  const output = {
    description: matched.text,
    iconKey: matched.icon,
    tempC: current.temperature_2m,
    feelsLikeC: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    windKph: current.wind_speed_10m,
    windDir: windDir(current.wind_direction_10m),
    place: PLACE,
    observedAt: current.time ? new Date(current.time + '+08:00').toISOString() : new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  process.stdout.write(`weather ${PLACE} ${output.tempC}°C ${output.description}\n`);
}

main().catch((error) => {
  process.stderr.write(String(error && error.message || error) + '\n');
  process.exitCode = 1;
});
