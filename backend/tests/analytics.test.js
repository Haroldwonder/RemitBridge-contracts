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
  Schemas: {
    payrollCreated: jest.fn().mockReturnValue({}),
    aidProgramCreated: jest.fn().mockReturnValue({}),
  },
  EventTypes: {},
  EVENT_VERSION: '1.0',
}));

process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const app = require('../src/index');
const { pool } = require('../src/db');

const ORG = { id: 1, name: 'TestOrg' };
const TOKEN = jwt.sign(ORG, 'test-secret');
const AUTH = { Authorization: `Bearer ${TOKEN}` };

beforeEach(() => pool.query.mockReset());

describe('GET /api/analytics/summary', () => {
  test('returns summary statistics', async () => {
    pool.query.mockResolvedValue({
      rows: [{
        completed_batches: '5',
        total_batches: '8',
        total_disbursed: '15000.00',
        successful_payments: '120',
        failed_payments: '3',
      }],
    });
    const res = await request(app).get('/api/analytics/summary').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_disbursed');
    expect(res.body).toHaveProperty('successful_payments');
  });

  test('requires auth', async () => {
    const res = await request(app).get('/api/analytics/summary');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/analytics/volume', () => {
  test('returns daily volume data', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { date: '2026-06-01', currency: 'USDC', batch_count: '2', total_amount: '5000' },
        { date: '2026-06-02', currency: 'USDC', batch_count: '1', total_amount: '2500' },
      ],
    });
    const res = await request(app).get('/api/analytics/volume?period=7d').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  test('supports currency filter', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/analytics/volume?currency=PYUSD').set(AUTH);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/analytics/by-currency', () => {
  test('returns per-currency breakdown', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { currency: 'USDC', batch_count: '10', total_amount: '50000', payment_count: '450' },
        { currency: 'PYUSD', batch_count: '3', total_amount: '8000', payment_count: '90' },
      ],
    });
    const res = await request(app).get('/api/analytics/by-currency').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /api/analytics/by-type', () => {
  test('returns breakdown by batch type', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { type: 'payroll', batch_count: '5', total_disbursed: '30000', total_recipients: '200' },
        { type: 'aid', batch_count: '2', total_disbursed: '5000', total_recipients: '80' },
      ],
    });
    const res = await request(app).get('/api/analytics/by-type').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.find(r => r.type === 'payroll')).toBeTruthy();
  });
});

describe('GET /api/analytics/recipients', () => {
  test('returns recipient statistics', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: '50', kyc_approved: '35', kyc_rejected: '5', kyc_pending: '10' }] })
      .mockResolvedValueOnce({ rows: [{ country: 'KE', count: '20' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/analytics/recipients').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('counts');
    expect(res.body).toHaveProperty('by_country');
    expect(res.body).toHaveProperty('top_recipients');
    expect(res.body.counts.total).toBe('50');
  });
});

describe('GET /api/analytics/payroll-metrics', () => {
  test('returns payroll-specific metrics', async () => {
    pool.query.mockResolvedValue({
      rows: [{ currency: 'USDC', payroll_runs: '4', total_payroll: '20000', avg_payroll_size: '5000' }],
    });
    const res = await request(app).get('/api/analytics/payroll-metrics').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
