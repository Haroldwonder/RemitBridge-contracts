const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { fundingAllocationService, trustScoreService } = require('../integrations/trustflow');
const { eventPublisher } = require('../events/EventPublisher');
const { Schemas } = require('../events/EventSchemas');

// GET /api/trustflow/allocations — list cached TrustFlow allocations
router.get('/allocations', auth, async (req, res) => {
  const allocations = await fundingAllocationService.getActiveAllocations(req.org.id);
  res.json(allocations);
});

// POST /api/trustflow/allocations/sync — force re-sync from TrustFlow
router.post('/allocations/sync', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT trustflow_org_id FROM orgs WHERE id=$1', [req.org.id]);
  const org = rows[0];
  if (!org?.trustflow_org_id) {
    return res.status(400).json({ error: 'TrustFlow not linked to this org. Set trustflow_org_id first.' });
  }
  const allocations = await fundingAllocationService.syncAllocations(req.org.id, org.trustflow_org_id);
  await eventPublisher.publish({
    event_type: 'remitbridge.trustflow.allocation_synced',
    event_version: '1.0',
    source: 'remitbridge',
    timestamp: new Date().toISOString(),
    payload: { org_id: req.org.id, count: allocations.length },
  });
  res.json({ synced: allocations.length, allocations });
});

// POST /api/trustflow/link — link this org to a TrustFlow org ID
router.post('/link', auth, async (req, res) => {
  const { trustflow_org_id } = req.body;
  if (!trustflow_org_id) return res.status(400).json({ error: 'trustflow_org_id required' });

  const { rows } = await pool.query(
    'UPDATE orgs SET trustflow_org_id=$1 WHERE id=$2 RETURNING id, name, trustflow_org_id',
    [trustflow_org_id, req.org.id]
  );
  await pool.query(
    `INSERT INTO audit_logs (org_id, action, details) VALUES ($1,'trustflow_linked',$2)`,
    [req.org.id, JSON.stringify({ trustflow_org_id })]
  );
  await eventPublisher.publish({
    event_type: 'remitbridge.org.trustflow_linked',
    event_version: '1.0',
    source: 'remitbridge',
    timestamp: new Date().toISOString(),
    payload: { org_id: req.org.id, trustflow_org_id },
  });
  res.json(rows[0]);
});

// GET /api/trustflow/trust-score — fetch trust score for this org
router.get('/trust-score', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT trustflow_org_id FROM orgs WHERE id=$1', [req.org.id]);
  const org = rows[0];
  if (!org?.trustflow_org_id) {
    return res.status(400).json({ error: 'TrustFlow not linked' });
  }
  const result = await trustScoreService.validateOrgTrustScore(org.trustflow_org_id);
  res.json(result);
});

// POST /api/trustflow/allocations/:id/consume — consume an allocation for a batch
router.post('/allocations/:id/consume', auth, async (req, res) => {
  const { amount, batch_id } = req.body;
  if (!amount || !batch_id) return res.status(400).json({ error: 'amount and batch_id required' });

  const alloc = await fundingAllocationService.consumeAllocation(
    req.org.id, req.params.id, Number(amount), batch_id
  );

  await eventPublisher.publish(
    Schemas.trustflowAllocationConsumed(req.params.id, req.org.id, batch_id, amount, alloc.currency)
  );

  // Link the allocation to the batch
  await pool.query(
    'UPDATE batches SET trustflow_allocation_id=$1 WHERE id=$2 AND org_id=$3',
    [req.params.id, batch_id, req.org.id]
  );

  res.json({ message: 'Allocation consumed', allocation: alloc });
});

module.exports = router;
