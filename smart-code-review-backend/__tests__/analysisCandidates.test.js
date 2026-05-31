jest.mock('../models/Analysis', () => ({
  create: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findByIdAndUpdate: jest.fn(),
}));

const Analysis = require('../models/Analysis');
const User = require('../models/User');
const { createAnalysis } = require('../controllers/analysisController');

function createMockResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('analysis response candidates', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GROQ_API_KEY;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key';
    Analysis.create.mockResolvedValue({ _id: 'analysis-id' });
    User.findByIdAndUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
    process.env.GROQ_API_KEY = originalApiKey;
  });

  it('requests multiple model answers and returns selectable candidates', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                reply: 'First answer',
                needsMoreContext: false,
                fileChanges: [],
              }),
            },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                reply: 'Second answer',
                needsMoreContext: false,
                fileChanges: [{
                  path: 'src/example.js',
                  operation: 'update',
                  severity: 'high',
                  summary: 'Example update.',
                  content: 'console.log("second");',
                }],
              }),
            },
          }],
        }),
      });

    const req = {
      user: { _id: '507f1f77bcf86cd799439011' },
      body: {
        message: 'Suggest two options',
        answerCount: 2,
        analysisMode: 'assistant',
        analysisScope: 'file',
      },
    };
    const res = createMockResponse();

    await createAnalysis(req, res);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      result: 'First answer',
      selectedCandidateIndex: 0,
      candidates: [
        expect.objectContaining({
          index: 0,
          reply: 'First answer',
          fileChanges: [],
        }),
        expect.objectContaining({
          index: 1,
          reply: 'Second answer',
          fileChanges: [expect.objectContaining({
            path: 'src/example.js',
            severity: 'high',
          })],
        }),
      ],
    }));
  });
});
