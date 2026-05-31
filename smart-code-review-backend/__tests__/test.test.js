const Analysis = require('../models/Analysis');

describe('Analysis test mode', () => {
  it('accepts unit-test generation analyses', () => {
    const analysis = new Analysis({
      user: '507f1f77bcf86cd799439011',
      code: 'Write unit tests for this project',
      language: 'Project',
      mode: 'test',
      result: {
        rawText: '## Test Plan\nCreate focused unit tests for critical behavior.',
      },
    });

    const error = analysis.validateSync();

    expect(error).toBeUndefined();
  });
});
