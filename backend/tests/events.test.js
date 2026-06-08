const { EventTypes, Schemas, EVENT_VERSION } = require('../src/events/EventSchemas');
const { EventPublisher } = require('../src/events/EventPublisher');

jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
  initDb: jest.fn().mockResolvedValue(),
}));
const { pool } = require('../src/db');

describe('EventSchemas', () => {
  test('EventTypes are frozen and non-empty', () => {
    expect(Object.isFrozen(EventTypes)).toBe(true);
    expect(Object.keys(EventTypes).length).toBeGreaterThan(10);
  });

  test('payrollCreated returns correct shape', () => {
    const batch = { id: 1, type: 'payroll', total_amount: 1000, currency: 'USDC', recipient_count: 5, trustflow_allocation_id: null };
    const event = Schemas.payrollCreated(batch, 42);
    expect(event.event_type).toBe(EventTypes.PAYROLL_CREATED);
    expect(event.event_version).toBe(EVENT_VERSION);
    expect(event.source).toBe('remitbridge');
    expect(event.payload.batch_id).toBe(1);
    expect(event.payload.org_id).toBe(42);
    expect(event.payload.total_amount).toBe(1000);
    expect(typeof event.timestamp).toBe('string');
  });

  test('payrollExecuted includes success and fail counts', () => {
    const batch = { id: 2, type: 'aid', total_amount: 500, currency: 'PYUSD', status: 'partial' };
    const event = Schemas.payrollExecuted(batch, 1, 4, 1);
    expect(event.event_type).toBe(EventTypes.PAYROLL_EXECUTED);
    expect(event.payload.success_count).toBe(4);
    expect(event.payload.fail_count).toBe(1);
  });

  test('transferSettled includes tx_hash', () => {
    const payment = { id: 99, stellar_address: 'GABC', amount: 10, currency: 'USDC', tx_hash: 'deadbeef' };
    const event = Schemas.transferSettled(payment, 5, 1);
    expect(event.event_type).toBe(EventTypes.TRANSFER_SETTLED);
    expect(event.payload.tx_hash).toBe('deadbeef');
  });

  test('beneficiaryCreated strips PII', () => {
    const recipient = { id: 7, country: 'KE', kyc_status: 'approved' };
    const event = Schemas.beneficiaryCreated(recipient, 1);
    expect(event.payload.recipient_id).toBe(7);
    expect(event.payload.country).toBe('KE');
    // Should NOT include name or email
    expect(event.payload.name).toBeUndefined();
    expect(event.payload.email).toBeUndefined();
  });

  test('complianceCheckCompleted includes check_type and status', () => {
    const record = { id: 3, recipient_id: 7, check_type: 'kyc', status: 'passed', risk_score: 25 };
    const event = Schemas.complianceCheckCompleted(record, 1);
    expect(event.event_type).toBe(EventTypes.COMPLIANCE_CHECK_COMPLETED);
    expect(event.payload.check_type).toBe('kyc');
    expect(event.payload.status).toBe('passed');
  });
});

describe('EventPublisher', () => {
  beforeEach(() => pool.query.mockReset());

  test('publish inserts into events_outbox and returns id', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 101 }] });
    const publisher = new EventPublisher();
    const event = { event_type: 'test.event', event_version: '1.0', source: 'test', timestamp: new Date().toISOString(), payload: {} };
    const id = await publisher.publish(event);
    expect(id).toBe(101);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO events_outbox'),
      expect.arrayContaining(['test.event', '1.0'])
    );
  });

  test('publishBatch publishes multiple events', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] });
    const publisher = new EventPublisher();
    const events = [
      { event_type: 'a', event_version: '1.0', source: 'test', timestamp: '', payload: {} },
      { event_type: 'b', event_version: '1.0', source: 'test', timestamp: '', payload: {} },
    ];
    const ids = await publisher.publishBatch(events);
    expect(ids).toEqual([1, 2]);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('getPendingEvents queries with limit', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const publisher = new EventPublisher();
    await publisher.getPendingEvents(25);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('pending'),
      [25]
    );
  });

  test('markDelivered updates status to delivered', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const publisher = new EventPublisher();
    await publisher.markDelivered(42);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("status='delivered'"),
      [42]
    );
  });

  test('markFailed increments attempts and stores error', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const publisher = new EventPublisher();
    await publisher.markFailed(42, 'Connection timeout');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('attempts=attempts+1'),
      expect.arrayContaining(['Connection timeout', 42])
    );
  });
});
