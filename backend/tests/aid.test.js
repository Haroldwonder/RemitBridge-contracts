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
    aidProgramCreated: jest.fn().mockReturnValue({}),
    payrollCreated: jest.fn().mockReturnValue({}),
  },
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

describe('POST /api/aid/programs', () => {
  test('creates an aid program', async () => {
    const mockProgram = {
      id: 1, name: 'Food Aid Kenya', program_type: 'cash', country: 'KE',
      budget_total: 50000, currency: 'USDC', active: true,
    };
    pool.query.mockResolvedValue({ rows: [mockProgram] });

    const res = await request(app)
      .post('/api/aid/programs')
      .set(AUTH)
      .send({ name: 'Food Aid Kenya', program_type: 'cash', country: 'KE', budget_total: 50000 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Food Aid Kenya');
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  test('rejects missing name', async () => {
    const res = await request(app).post('/api/aid/programs').set(AUTH).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  test('requires auth', async () => {
    const res = await request(app).post('/api/aid/programs').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/aid/programs', () => {
  test('returns paginated programs', async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, name: 'Program A', active: true },
        { id: 2, name: 'Program B', active: false },
      ],
    });
    const res = await request(app).get('/api/aid/programs').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('supports active filter', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/aid/programs?active=true').set(AUTH);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/aid/groups', () => {
  test('creates a beneficiary group', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 3 }] })  // program lookup
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Group A', org_id: 1 }] });

    const res = await request(app)
      .post('/api/aid/groups')
      .set(AUTH)
      .send({ name: 'Group A', aid_program_id: 3, country: 'KE' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Group A');
  });

  test('rejects invalid program id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // program not found
    const res = await request(app)
      .post('/api/aid/groups')
      .set(AUTH)
      .send({ name: 'Group A', aid_program_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/aid_program_id/);
  });
});

describe('POST /api/aid/groups/:id/members', () => {
  test('adds recipients to group', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // group lookup
      .mockResolvedValue({ rows: [] });               // inserts

    const res = await request(app)
      .post('/api/aid/groups/1/members')
      .set(AUTH)
      .send({ recipient_ids: [10, 11, 12] });

    expect(res.status).toBe(200);
    expect(res.body.added).toBe(3);
  });

  test('rejects missing recipient_ids', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app)
      .post('/api/aid/groups/1/members')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/aid/programs/:id/disburse', () => {
  test('creates a batch from beneficiary group', async () => {
    const mockBatch = { id: 10, type: 'aid', status: 'pending', total_amount: 300, currency: 'USDC' };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, budget_total: 10000, budget_spent: 0, currency: 'USDC', active: true }] })  // program
      .mockResolvedValueOnce({ rows: [
        { id: 5, stellar_address: 'GABC', name: 'Alice' },
        { id: 6, stellar_address: 'GDEF', name: 'Bob' },
        { id: 7, stellar_address: 'GHIJ', name: 'Carol' },
      ]})  // members
      .mockResolvedValueOnce({ rows: [mockBatch] })  // batch insert
      .mockResolvedValue({ rows: [] });               // payment inserts + budget update

    const res = await request(app)
      .post('/api/aid/programs/1/disburse')
      .set(AUTH)
      .send({ group_id: 2, amount_per_recipient: 100, currency: 'USDC' });

    expect(res.status).toBe(201);
    expect(res.body.batch.type).toBe('aid');
    expect(res.body.payment_count).toBe(3);
    expect(res.body.total).toBe(300);
  });

  test('rejects insufficient budget', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, budget_total: 100, budget_spent: 50, currency: 'USDC', active: true }] })
      .mockResolvedValueOnce({ rows: [
        { id: 5, stellar_address: 'GABC' },
        { id: 6, stellar_address: 'GDEF' },
      ]});

    const res = await request(app)
      .post('/api/aid/programs/1/disburse')
      .set(AUTH)
      .send({ group_id: 2, amount_per_recipient: 100, currency: 'USDC' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/budget/i);
  });

  test('requires group_id and amount_per_recipient', async () => {
    const res = await request(app)
      .post('/api/aid/programs/1/disburse')
      .set(AUTH)
      .send({});
    expect(res.status).toBe(400);
  });
});
