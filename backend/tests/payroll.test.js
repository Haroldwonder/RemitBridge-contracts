const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/db', () => ({
  pool: { query: jest.fn() },
  initDb: jest.fn().mockResolvedValue(),
}));
jest.mock('../src/events/EventPublisher', () => ({
  eventPublisher: { publish: jest.fn().mockResolvedValue(1) },
  EventPublisher: jest.fn(),
}));
jest.mock('../src/events/EventSchemas', () => ({
  Schemas: { payrollCreated: jest.fn().mockReturnValue({}) },
  EventTypes: {},
  EVENT_VERSION: '1.0',
}));

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const app = require('../src/index');
const { pool } = require('../src/db');
const { eventPublisher } = require('../src/events/EventPublisher');

const ORG = { id: 1, name: 'TestOrg' };
const TOKEN = jwt.sign(ORG, 'test-secret');
const AUTH = { Authorization: `Bearer ${TOKEN}` };

beforeEach(() => {
  pool.query.mockReset();
  eventPublisher.publish.mockReset().mockResolvedValue(1);
});

describe('POST /api/payroll/schedules', () => {
  test('creates a payroll schedule', async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, name: 'Monthly Payroll', currency: 'USDC', cron_expr: '0 0 1 * *', active: true }],
    });
    const res = await request(app)
      .post('/api/payroll/schedules')
      .set(AUTH)
      .send({ name: 'Monthly Payroll', currency: 'USDC', cron_expr: '0 0 1 * *' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Monthly Payroll');
  });

  test('rejects missing cron_expr', async () => {
    const res = await request(app)
      .post('/api/payroll/schedules')
      .set(AUTH)
      .send({ name: 'Test', currency: 'USDC' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cron_expr/);
  });

  test('rejects invalid currency', async () => {
    const res = await request(app)
      .post('/api/payroll/schedules')
      .set(AUTH)
      .send({ name: 'Test', currency: 'BTC', cron_expr: '0 0 1 * *' });
    expect(res.status).toBe(400);
  });

  test('requires auth', async () => {
    const res = await request(app).post('/api/payroll/schedules').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/payroll/schedules', () => {
  test('returns schedule list', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, name: 'Monthly', cron_expr: '0 0 1 * *', active: true },
        { id: 2, name: 'Weekly', cron_expr: '0 0 * * 1', active: false },
      ],
    });
    const res = await request(app).get('/api/payroll/schedules').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('POST /api/payroll/batches/:id/approve', () => {
  test('approves a payroll batch awaiting approval', async () => {
    const mockBatch = { id: 5, status: 'awaiting_approval', type: 'payroll', total_amount: 10000 };
    pool.query
      .mockResolvedValueOnce({ rows: [mockBatch] })              // batch lookup
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })             // insert approval
      .mockResolvedValueOnce({ rows: [{ min_approvals: 1, approved_count: 1 }] })  // count check
      .mockResolvedValueOnce({ rows: [] });                      // status update

    const res = await request(app)
      .post('/api/payroll/batches/5/approve')
      .set(AUTH)
      .send({ note: 'Approved for Q2' });
    expect(res.status).toBe(201);
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  test('rejects batch not awaiting approval', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 5, status: 'complete' }] });
    const res = await request(app)
      .post('/api/payroll/batches/5/approve')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/awaiting approval/i);
  });

  test('returns 404 for non-existent batch', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/payroll/batches/99/approve').set(AUTH).send({});
    expect(res.status).toBe(404);
  });
});

describe('GET /api/payroll/batches', () => {
  test('returns payroll batches with pagination', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, type: 'payroll', status: 'complete', total_amount: 10000 },
        { id: 2, type: 'contractor', status: 'pending', total_amount: 5000 },
      ],
    });
    const res = await request(app).get('/api/payroll/batches?page=1&limit=10').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('supports status filter', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/payroll/batches?status=complete').set(AUTH);
    expect(res.status).toBe(200);
  });
});
