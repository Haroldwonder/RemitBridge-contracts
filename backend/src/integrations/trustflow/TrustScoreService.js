const { TrustFlowProvider } = require('./TrustFlowProvider');
const { TrustFlowAdapter } = require('./TrustFlowAdapter');
const { pool } = require('../../db');

const MINIMUM_TRUST_SCORE = Number(process.env.MINIMUM_TRUST_SCORE || 30);
const SCORE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const scoreCache = new Map();

class TrustScoreService {
  constructor(provider, adapter) {
    this.provider = provider || new TrustFlowProvider();
    this.adapter = adapter || new TrustFlowAdapter();
  }

  /**
   * Fetch and cache trust score for a TrustFlow org or recipient.
   */
  async getTrustScore(subjectId, subjectType = 'org') {
    const key = `${subjectType}:${subjectId}`;
    const cached = scoreCache.get(key);
    if (cached && Date.now() - cached.ts < SCORE_CACHE_TTL_MS) {
      return cached.score;
    }

    const raw = await this.provider.getTrustScore(subjectId, subjectType);
    const score = this.adapter.adaptTrustScore(raw);
    scoreCache.set(key, { score, ts: Date.now() });
    return score;
  }

  /**
   * Validate that an org's trust score meets the minimum threshold.
   * Returns { allowed: boolean, score: TrustScore, reason?: string }
   */
  async validateOrgTrustScore(trustflowOrgId) {
    if (!trustflowOrgId) {
      return { allowed: true, score: null, reason: 'TrustFlow not linked — bypassing check' };
    }
    try {
      const score = await this.getTrustScore(trustflowOrgId, 'org');
      const allowed = score.score >= MINIMUM_TRUST_SCORE;
      return {
        allowed,
        score,
        reason: allowed ? undefined : `Trust score ${score.score} below minimum ${MINIMUM_TRUST_SCORE}`,
      };
    } catch (e) {
      // Fail open when TrustFlow is unavailable — log and allow
      console.warn(`TrustFlow trust score check failed for ${trustflowOrgId}: ${e.message}`);
      return { allowed: true, score: null, reason: 'TrustFlow unavailable — check skipped' };
    }
  }

  /**
   * Update a recipient's trust score in the local DB from TrustFlow data.
   */
  async syncRecipientTrustScore(recipientId, trustflowRecipientId) {
    const raw = await this.provider.getTrustScore(trustflowRecipientId, 'recipient');
    const score = this.adapter.adaptTrustScore(raw);
    await pool.query(
      'UPDATE recipients SET trust_score=$1 WHERE id=$2',
      [score.score, recipientId]
    );
    return score;
  }
}

module.exports = { TrustScoreService };
