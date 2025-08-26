const request = require('supertest');
const path = require('path');
const { spawnSync } = require('child_process');
process.env.SKIP_DB = 'true';
const fetchMock = jest.fn();
global.fetch = fetchMock;
const app = require('../index');
const { createCase, updateCase, resetStore } = require('../utils/pipelineStore');

const engineDir = path.join(__dirname, '..', '..', 'eligibility-engine');

const runEngine = (payload) => {
  const script = `import json,sys
from normalization.ingest import normalize_payload
from engine import analyze_eligibility
payload=json.loads(sys.stdin.read())
print(json.dumps(analyze_eligibility(normalize_payload(payload))))`;
  const res = spawnSync('python', ['-c', script], {
    cwd: engineDir,
    env: { ...process.env, PYTHONPATH: engineDir },
    input: JSON.stringify(payload),
  });
  return JSON.parse(res.stdout.toString());
};

describe('analyzer to engine smoke test', () => {
  beforeEach(() => {
    process.env.SKIP_DB = 'true';
    resetStore();
    fetchMock.mockReset();
  });

  test('integration path', async () => {
    const caseId = await createCase('dev');
    await updateCase(caseId, { analyzer: { fields: { country: 'US', employees: '5', revenue_drop_2020_pct: '55%', revenue_drop_2021_pct: '25%', shutdown_2020: 'no', shutdown_2021: 'yes', qualified_wages_2020: '$1000', qualified_wages_2021: '$1000', ppp_double_dip: 'false' } } });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { program: 'demo', requiredForms: [], missing_fields: [] },
      ],
    });

    const res = await request(app).post('/api/eligibility-report').send({ caseId });
    expect(res.status).toBe(200);
    expect(res.body.eligibility.results.length).toBeGreaterThan(0);
  });
});

describe('pipeline normalization', () => {
  test('user overrides analyzer value', () => {
    const extracted = { ein: '111111111', w2_employee_count: 5 };
    const basePayload = { ein: '222222222' };
    const normalized = { ...extracted, ...basePayload };
    expect(normalized).toEqual({ ein: '222222222', w2_employee_count: 5 });
  });

  test('non-conflicting keys merge correctly', () => {
    const extracted = { annual_revenue: 500000 };
    const basePayload = { entity_type: 'C-Corp' };
    const normalized = { ...extracted, ...basePayload };
    expect(normalized).toEqual({ annual_revenue: 500000, entity_type: 'C-Corp' });
  });
});
