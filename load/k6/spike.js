import http from 'k6/http';
export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};
export default function () {
  const base = __ENV.K6_BASE_URL || 'http://localhost:5000';
  http.get(`${base}/status`);
}
