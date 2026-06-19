const core = require('../domain-core.cjs');

describe('weightedPercentile', () => {
  it('is exported from the module', () => {
    expect(typeof core.weightedPercentile).toBe('function');
  });
});
