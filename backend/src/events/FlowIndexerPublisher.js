const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { eventPublisher } = require('./EventPublisher');

const FLOW_INDEXER_URL = process.env.FLOW_INDEXER_URL || 'https://api.flowindexer.opentrust.dev';
const FLOW_INDEXER_KEY = process.env.FLOW_INDEXER_API_KEY || '';
const POLL_INTERVAL_MS = Number(process.env.EVENT_POLL_INTERVAL_MS || 5000);
const DELIVERY_TIMEOUT_MS = 8000;

/**
 * Background worker that reads pending events from the outbox
 * and delivers them to FlowIndexer over HTTP.
 *
 * Uses the transactional outbox pattern: events are guaranteed to be
 * at-least-once delivered. FlowIndexer must handle idempotent ingestion.
 */
class FlowIndexerPublisher {
  constructor() {
    this._timer = null;
    this._running = false;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._flush(), POLL_INTERVAL_MS);
    // Immediate first flush
    this._flush();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _flush() {
    if (this._running) return;
    this._running = true;
    try {
      const events = await eventPublisher.getPendingEvents(50);
      for (const event of events) {
        await this._deliver(event);
      }
    } catch (e) {
      console.error('FlowIndexerPublisher flush error:', e.message);
    } finally {
      this._running = false;
    }
  }

  async _deliver(outboxRow) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      const res = await fetch(`${FLOW_INDEXER_URL}/v1/ingest`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': FLOW_INDEXER_KEY,
          'X-Source': 'remitbridge',
          'X-Event-Id': String(outboxRow.id),
        },
        body: typeof outboxRow.payload === 'string'
          ? outboxRow.payload
          : JSON.stringify(outboxRow.payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`FlowIndexer ${res.status}: ${body}`);
      }
      await eventPublisher.markDelivered(outboxRow.id);
    } catch (e) {
      await eventPublisher.markFailed(outboxRow.id, e.message);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * One-shot synchronous delivery for testing or manual retry.
   */
  async deliverNow(event) {
    return this._deliver(event);
  }
}

const flowIndexerPublisher = new FlowIndexerPublisher();

module.exports = { FlowIndexerPublisher, flowIndexerPublisher };
