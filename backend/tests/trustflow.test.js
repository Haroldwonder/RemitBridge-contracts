const { TrustFlowAdapter } = require('../src/integrations/trustflow/TrustFlowAdapter');

describe('TrustFlowAdapter', () => {
  const adapter = new TrustFlowAdapter();

  describe('adaptAllocation', () => {
    test('maps standard allocation response', () => {
      const raw = {
        id: 'alloc-123',
        org_id: 'tf-org-1',
        amount: '5000.00',
        currency: 'USDC',
        status: 'active',
        remaining_amount: '3500.00',
        expires_at: '2026-12-31T00:00:00Z',
        metadata: { source: 'grant' },
      };
      const result = adapter.adaptAllocation(raw);
      expect(result.id).toBe('alloc-123');
      expect(result.amount).toBe(5000);
      expect(result.remainingAmount).toBe(3500);
      expect(result.status).toBe('active');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.metadata.source).toBe('grant');
    });

    test('normalizes "approved" status to "active"', () => {
      const raw = { id: '1', org_id: '1', amount: 100, currency: 'USDC', status: 'approved' };
      const result = adapter.adaptAllocation(raw);
      expect(result.status).toBe('active');
    });

    test('handles missing optional fields with defaults', () => {
      const raw = { id: '2', org_id: '1' };
      const result = adapter.adaptAllocation(raw);
      expect(result.amount).toBe(0);
      expect(result.expiresAt).toBeNull();
      expect(result.metadata).toEqual({});
    });

    test('adaptAllocations maps array', () => {
      const raws = [
        { id: '1', org_id: '1', amount: 100, currency: 'USDC', status: 'active' },
        { id: '2', org_id: '1', amount: 200, currency: 'PYUSD', status: 'consumed' },
      ];
      const results = adapter.adaptAllocations(raws);
      expect(results).toHaveLength(2);
      expect(results[0].currency).toBe('USDC');
      expect(results[1].status).toBe('consumed');
    });
  });

  describe('adaptTrustScore', () => {
    test('maps standard trust score', () => {
      const raw = { subject_id: 'org-42', subject_type: 'org', score: 75, tier: 'high', computed_at: '2026-01-01T00:00:00Z' };
      const result = adapter.adaptTrustScore(raw);
      expect(result.subjectId).toBe('org-42');
      expect(result.score).toBe(75);
      expect(result.tier).toBe('high');
    });

    test('computes tier from score when tier absent', () => {
      expect(adapter.adaptTrustScore({ score: 85 }).tier).toBe('high');
      expect(adapter.adaptTrustScore({ score: 60 }).tier).toBe('medium');
      expect(adapter.adaptTrustScore({ score: 25 }).tier).toBe('low');
      expect(adapter.adaptTrustScore({ score: 5 }).tier).toBe('none');
    });

    test('handles trust_score field alias', () => {
      const raw = { trust_score: 55, entity_id: 'rec-1' };
      const result = adapter.adaptTrustScore(raw);
      expect(result.score).toBe(55);
    });
  });

  describe('adaptApprovedRecipients', () => {
    test('maps recipients array', () => {
      const raws = [
        { id: 'r1', name: 'Alice', stellar_address: 'GABC', kyc_status: 'approved', trust_score: 80, country: 'KE' },
        { id: 'r2', name: 'Bob', wallet_address: 'GDEF', kyc_status: 'pending', country: 'NG' },
      ];
      const results = adapter.adaptApprovedRecipients(raws);
      expect(results).toHaveLength(2);
      expect(results[0].stellarAddress).toBe('GABC');
      expect(results[1].stellarAddress).toBe('GDEF'); // wallet_address fallback
      expect(results[0].kycStatus).toBe('approved');
    });

    test('returns empty array for empty input', () => {
      expect(adapter.adaptApprovedRecipients([])).toEqual([]);
      expect(adapter.adaptApprovedRecipients()).toEqual([]);
    });
  });

  describe('adaptFundingStream', () => {
    test('maps funding stream', () => {
      const raw = {
        id: 'stream-1', org_id: 'org-1', total_amount: 10000,
        disbursed_amount: 2000, currency: 'USDC', frequency: 'monthly',
        status: 'active', start_date: '2026-01-01', end_date: '2026-12-31',
      };
      const result = adapter.adaptFundingStream(raw);
      expect(result.id).toBe('stream-1');
      expect(result.totalAmount).toBe(10000);
      expect(result.frequency).toBe('monthly');
    });
  });
});
