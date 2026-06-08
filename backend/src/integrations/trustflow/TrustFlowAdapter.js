/**
 * Normalizes raw TrustFlow API responses into RemitBridge domain objects.
 * Isolates RemitBridge from TrustFlow API shape changes.
 */

class TrustFlowAdapter {
  /**
   * @param {object} raw TrustFlow allocation response
   * @returns {TrustFlowAllocation}
   */
  adaptAllocation(raw) {
    return {
      id: String(raw.id || raw.allocation_id),
      orgId: String(raw.org_id),
      amount: Number(raw.amount || raw.allocated_amount || 0),
      currency: raw.currency || raw.asset || 'USDC',
      status: this._normalizeAllocationStatus(raw.status),
      remainingAmount: Number(raw.remaining_amount || raw.available || raw.amount || 0),
      metadata: raw.metadata || {},
      expiresAt: raw.expires_at ? new Date(raw.expires_at) : null,
      createdAt: raw.created_at ? new Date(raw.created_at) : new Date(),
    };
  }

  /**
   * @param {object[]} raws
   * @returns {TrustFlowAllocation[]}
   */
  adaptAllocations(raws = []) {
    return raws.map(r => this.adaptAllocation(r));
  }

  /**
   * @param {object} raw TrustFlow trust score response
   * @returns {TrustScore}
   */
  adaptTrustScore(raw) {
    return {
      subjectId: String(raw.subject_id || raw.entity_id || ''),
      subjectType: raw.subject_type || 'unknown',
      score: Number(raw.score || raw.trust_score || 0),
      tier: raw.tier || this._scoreTier(Number(raw.score || 0)),
      components: raw.components || {},
      computedAt: raw.computed_at ? new Date(raw.computed_at) : new Date(),
      expiresAt: raw.expires_at ? new Date(raw.expires_at) : null,
    };
  }

  /**
   * @param {object} raw TrustFlow funding stream
   * @returns {FundingStream}
   */
  adaptFundingStream(raw) {
    return {
      id: String(raw.id || raw.stream_id),
      orgId: String(raw.org_id),
      totalAmount: Number(raw.total_amount || 0),
      disbursedAmount: Number(raw.disbursed_amount || 0),
      currency: raw.currency || 'USDC',
      frequency: raw.frequency || 'monthly',
      status: raw.status || 'active',
      startDate: raw.start_date ? new Date(raw.start_date) : null,
      endDate: raw.end_date ? new Date(raw.end_date) : null,
    };
  }

  /**
   * @param {object[]} raws TrustFlow approved recipient list
   * @returns {ApprovedRecipient[]}
   */
  adaptApprovedRecipients(raws = []) {
    return raws.map(r => ({
      externalId: String(r.id || r.recipient_id),
      name: r.name || '',
      stellarAddress: r.stellar_address || r.wallet_address || '',
      kycStatus: r.kyc_status || 'pending',
      trustScore: Number(r.trust_score || 0),
      country: r.country || '',
    }));
  }

  _normalizeAllocationStatus(raw) {
    const map = {
      active: 'active',
      approved: 'active',
      pending: 'pending',
      consumed: 'consumed',
      expired: 'expired',
      cancelled: 'cancelled',
    };
    return map[String(raw).toLowerCase()] || 'unknown';
  }

  _scoreTier(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    if (score >= 20) return 'low';
    return 'none';
  }
}

module.exports = { TrustFlowAdapter };
