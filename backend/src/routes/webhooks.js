const router = require('express').Router();
const { pool } = require('../db');
const { fundingAllocationService } = require('../integrations/trustflow');
const { eventPublisher } = require('../events/EventPublisher');
const { Schemas } = require('../events/EventSchemas');

const TRUSTFLOW_WEBHOOK_SECRET = process.env.TRUSTFLOW_WEBHOOK_SECRET || '';
const FLOWINDEXER_WEBHOOK_SECRET = process.env.FLOWINDEXER_WEBHOOK_SECRET || '';

function verifySecret(req, secret) {
  if (!secret) return true; // No secret configured — skip verification
  const sig = req.headers['x-webhook-signature'] || req.headers['x-hub-signature-256'] || '';
  return sig === `sha256=${secret}`;
}

// POST /api/webhooks/trustflow — receive events from TrustFlow
router.post('/trustflow', async (req, res) => {
  if (!verifySecret(req, TRUSTFLOW_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { event_type, payload } = req.body;
  if (!event_type || !payload) return res.status(400).json({ error: 'event_type and payload required' });

  // Handle known TrustFlow event types
  switch (event_type) {
    case 'trustflow.allocation.approved': {
      // Sync new allocation into our cache
      const { allocation, org_id } = payload;
      if (allocation && org_id) {
        try {
          const { rows } = await pool.query(
            'SELECT id FROM orgs WHERE trustflow_org_id=$1',
            [String(org_id)]
          );
          if (rows[0]) {
            await pool.query(
              `INSERT INTO trustflow_allocations
                 (org_id, trustflow_allocation_id, trustflow_org_id, amount, currency, status, metadata, fetched_at)
               VALUES ($1,$2,$3,$4,$5,'active',$6,NOW())
               ON CONFLICT (trustflow_allocation_id) DO UPDATE SET
                 status='active', amount=EXCLUDED.amount, fetched_at=NOW()`,
              [rows[0].id, String(allocation.id), String(org_id),
               allocation.amount, allocation.currency || 'USDC',
               JSON.stringify(allocation.metadata || {})]
            );
            await eventPublisher.publish(
              Schemas.trustflowAllocationConsumed(
                allocation.id, rows[0].id, null, 0, allocation.currency
              )
            );
          }
        } catch (e) {
          console.error('trustflow.allocation.approved handler error:', e.message);
        }
      }
      break;
    }

    case 'trustflow.stream.updated': {
      // A funding stream was updated — no action needed, org can re-fetch
      break;
    }

    case 'trustflow.org.suspended': {
      // Flag all batches for this org's TrustFlow link
      const { org_id } = payload;
      if (org_id) {
        await pool.query(
          `UPDATE audit_logs SET details=details || '{"trustflow_suspended":true}'
           WHERE org_id=(SELECT id FROM orgs WHERE trustflow_org_id=$1) AND action='batch_submitted'`,
          [String(org_id)]
        );
      }
      break;
    }

    default:
      // Unknown event type — acknowledge and ignore
      break;
  }

  res.json({ received: true, event_type });
});

// POST /api/webhooks/flowindexer — receive events from FlowIndexer (e.g. analytics triggers)
router.post('/flowindexer', async (req, res) => {
  if (!verifySecret(req, FLOWINDEXER_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { event_type, payload } = req.body;
  // Acknowledge all FlowIndexer events; add specific handlers as needed
  console.log(`FlowIndexer webhook: ${event_type}`, JSON.stringify(payload));
  res.json({ received: true });
});

module.exports = router;
