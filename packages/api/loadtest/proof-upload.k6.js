// k6 load test: 500 concurrent users submitting proof photos.
//
// Required env: API_URL, ACCESS_TOKEN (single seeded session), GROUP_ID, HABIT_ID.
// Run:
//   k6 run -e API_URL=https://api.example.com -e ACCESS_TOKEN=... \
//          -e GROUP_ID=... -e HABIT_ID=... proof-upload.k6.js
//
// Pass criteria: p95 latency < 90s end-to-end, error rate < 2%.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const failures = new Rate('proof_failures');
const e2e = new Trend('proof_e2e_ms');

export const options = {
  scenarios: {
    proof_upload: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    proof_failures: ['rate<0.02'],
    proof_e2e_ms: ['p(95)<90000'],
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3000';
const TOKEN = __ENV.ACCESS_TOKEN;
const GROUP_ID = __ENV.GROUP_ID;
const HABIT_ID = __ENV.HABIT_ID;

// 1x1 transparent jpeg
const TINY_JPEG = open('./tiny.jpg', 'b');

export default function () {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  const presign = http.post(
    `${API_URL}/logs/upload-url`,
    JSON.stringify({ groupId: GROUP_ID, habitId: HABIT_ID, contentType: 'image/jpeg' }),
    { headers },
  );
  const presignOk = check(presign, { 'presign 201': (r) => r.status === 201 });
  if (!presignOk) {
    failures.add(1);
    return;
  }
  const { logId, uploadUrl } = presign.json();

  const put = http.put(uploadUrl, TINY_JPEG, { headers: { 'Content-Type': 'image/jpeg' } });
  const putOk = check(put, { 'put 200': (r) => r.status === 200 });
  if (!putOk) {
    failures.add(1);
    return;
  }

  const confirm = http.post(
    `${API_URL}/logs`,
    JSON.stringify({ logId, clientTimestamp: new Date().toISOString() }),
    { headers },
  );
  const confirmOk = check(confirm, { 'confirm 200': (r) => r.status === 200 });
  failures.add(!confirmOk);

  e2e.add(Date.now() - start);
  sleep(Math.random() * 3);
}
