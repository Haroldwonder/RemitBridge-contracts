const { TrustFlowProvider, TrustFlowError } = require('./TrustFlowProvider');
const { TrustFlowAdapter } = require('./TrustFlowAdapter');
const { TrustScoreService } = require('./TrustScoreService');
const { FundingAllocationService } = require('./FundingAllocationService');

// Singletons shared across the application
const provider = new TrustFlowProvider();
const adapter = new TrustFlowAdapter();
const trustScoreService = new TrustScoreService(provider, adapter);
const fundingAllocationService = new FundingAllocationService(provider, adapter);

module.exports = {
  TrustFlowProvider,
  TrustFlowAdapter,
  TrustScoreService,
  FundingAllocationService,
  TrustFlowError,
  provider,
  adapter,
  trustScoreService,
  fundingAllocationService,
};
