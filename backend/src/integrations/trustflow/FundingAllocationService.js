const { TrustFlowProvider } = require('./TrustFlowProvider');
const { TrustFlowAdapter } = require('./TrustFlowAdapter');
const { pool } = require('../../db');

class FundingAllocationService {
  constructor(provider, adapter) {
    this.provider = provider || new TrustFlowProvider();
    this.adapter = adapter || new TrustFlowAdapter();
  }

  /**
   * Pull active allocations from TrustFlow and cache them locally.
   */
  async syncAllocations(orgId, trustflowOrgId) {
    const raw = await this.provider.getFundingAllocations(trustflowOrgId);
    const allocations = this.adapter.adaptAllocations(raw.allocations || raw);

    for (const alloc of allocations) {
      await pool.query(
        `INSERT INTO trustflow_allocations
           (org_id, trustflow_allocation_id, trustflow_org_id, amount, currency, status, metadata, fetched_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8)
         ON CONFLICT (trustflow_allocation_id) DO UPDATE SET
           amount=EXCLUDED.amount, status=EXCLUDED.status,
           metadata=EXCLUDED.metadata, fetched_at=NOW(), expires_at=EXCLUDED.expires_at`,
        [
          orgId,
          alloc.id,
          trustflowOrgId,
          alloc.amount,
          alloc.currency,
          alloc.status,
          JSON.stringify(alloc.metadata),
          alloc.expiresAt,
        ]
      );
    }
    return allocations;
  }

  /**
   * Get cached active allocations for an org.
   */
  async getActiveAllocations(orgId) {
    const { rows } = await pool.query(
      `SELECT * FROM trustflow_allocations
       WHERE org_id=$1 AND status='active'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY fetched_at DESC`,
      [orgId]
    );
    return rows;
  }

  /**
   * Lock and consume an allocation for a batch disbursement.
   * Records consumption locally and notifies TrustFlow.
   */
  async consumeAllocation(orgId, allocationId, consumedAmount, batchId) {
    const { rows } = await pool.query(
      `SELECT * FROM trustflow_allocations
       WHERE org_id=$1 AND trustflow_allocation_id=$2 AND status='active'`,
      [orgId, allocationId]
    );
    const alloc = rows[0];
    if (!alloc) throw new Error(`Allocation ${allocationId} not found or not active`);

    if (Number(alloc.amount) < consumedAmount) {
      throw new Error(`Allocation amount ${alloc.amount} insufficient for ${consumedAmount}`);
    }

    // Mark consumed locally
    await pool.query(
      `UPDATE trustflow_allocations SET status='consumed', fetched_at=NOW() WHERE id=$1`,
      [alloc.id]
    );

    // Notify TrustFlow (best-effort)
    try {
      await this.provider.markAllocationConsumed(allocationId, consumedAmount, { batch_id: batchId });
    } catch (e) {
      console.warn(`Failed to notify TrustFlow of allocation consumption: ${e.message}`);
    }

    return alloc;
  }

  /**
   * Build batch payment rows from a TrustFlow allocation + approved recipients.
   */
  async buildPaymentsFromAllocation(orgId, trustflowOrgId, allocationId) {
    const [rawAlloc, rawRecipients] = await Promise.all([
      this.provider.getFundingAllocation(allocationId),
      this.provider.getApprovedRecipients(trustflowOrgId),
    ]);

    const alloc = this.adapter.adaptAllocation(rawAlloc);
    const recipients = this.adapter.adaptApprovedRecipients(rawRecipients.recipients || rawRecipients);

    // Distribute evenly among approved recipients (simplest strategy)
    const perRecipient = (alloc.amount / recipients.length).toFixed(7);

    return recipients
      .filter(r => r.stellarAddress)
      .map(r => ({
        stellar_address: r.stellarAddress,
        amount: perRecipient,
        currency: alloc.currency,
        trustflow_recipient_id: r.externalId,
      }));
  }
}

module.exports = { FundingAllocationService };
