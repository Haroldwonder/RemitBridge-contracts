const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const BASE_URL = process.env.TRUSTFLOW_API_URL || 'https://api.trustflow.opentrust.dev';
const API_KEY = process.env.TRUSTFLOW_API_KEY || '';
const TIMEOUT_MS = 10000;

class TrustFlowProvider {
  constructor(baseUrl = BASE_URL, apiKey = API_KEY) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new TrustFlowError(`TrustFlow ${res.status}: ${body}`, res.status);
      }
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async getFundingAllocations(orgId) {
    return this.request(`/v1/allocations?org_id=${orgId}`);
  }

  async getFundingAllocation(allocationId) {
    return this.request(`/v1/allocations/${allocationId}`);
  }

  async getApprovedRecipients(orgId) {
    return this.request(`/v1/orgs/${orgId}/approved-recipients`);
  }

  async getOrganizationGrants(orgId) {
    return this.request(`/v1/orgs/${orgId}/grants`);
  }

  async getFundingStream(streamId) {
    return this.request(`/v1/streams/${streamId}`);
  }

  async getTrustScore(subjectId, subjectType = 'org') {
    return this.request(`/v1/trust-scores/${subjectType}/${subjectId}`);
  }

  async getReputationScore(subjectId, subjectType = 'org') {
    return this.request(`/v1/reputation/${subjectType}/${subjectId}`);
  }

  async markAllocationConsumed(allocationId, consumedAmount, metadata = {}) {
    return this.request(`/v1/allocations/${allocationId}/consume`, {
      method: 'POST',
      body: JSON.stringify({ consumed_amount: consumedAmount, metadata }),
    });
  }
}

class TrustFlowError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'TrustFlowError';
    this.statusCode = statusCode;
  }
}

module.exports = { TrustFlowProvider, TrustFlowError };
