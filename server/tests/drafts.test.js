const fs = require('fs');
const path = require('path');
const { saveDraft } = require('../utils/drafts');
const logger = require('../utils/logger');

const base64Pdf = 'JVBERi0xLjEKMSAwIG9iago8PD4+CmVuZG9iagpzdGFydHhyZWYKMAolJUVPRg==';

function mockReq() {
  return {
    id: 'test',
    get: () => 'localhost',
    protocol: 'http',
  };
}

describe('drafts.saveDraft', () => {
  const tmpDir = path.join(__dirname, 'tmp');
  beforeEach(() => {
    process.env.DRAFTS_DIR = tmpDir;
    logger.logs.length = 0;
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes valid pdf and returns url', async () => {
    const buffer = Buffer.from(base64Pdf, 'base64');
    const url = await saveDraft('case1', 'form1', buffer, mockReq());
    expect(url).toMatch(/case1\/form1\.pdf$/);
    const filePath = path.join(tmpDir, 'case1', 'form1.pdf');
    const contents = await fs.promises.readFile(filePath);
    expect(contents.slice(0,5).toString()).toBe('%PDF-');
    const log = logger.logs.find((l) => l.message === 'draft_saved');
    expect(log).toBeDefined();
    expect(log.size).toBeGreaterThan(0);
  });

  test('returns undefined and logs when invalid', async () => {
    const buffer = Buffer.from('not a pdf');
    const url = await saveDraft('case2', 'form1', buffer, mockReq());
    expect(url).toBeUndefined();
    const log = logger.logs.find((l) => l.message === 'draft_invalid_pdf');
    expect(log).toBeDefined();
  });
});
