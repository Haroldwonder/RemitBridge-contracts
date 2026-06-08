const { pool } = require('../db');

/**
 * Outbox-pattern event publisher.
 * Events are written to the events_outbox table atomically with the DB transaction
 * that produced the business event. A background worker (FlowIndexerPublisher)
 * reads and delivers pending events to FlowIndexer.
 */
class EventPublisher {
  /**
   * Enqueue an event in the outbox (within a transaction client).
   * @param {object} event - shaped by EventSchemas
   * @param {object} [client] - optional pg transaction client
   */
  async publish(event, client) {
    const db = client || pool;
    const { rows } = await db.query(
      `INSERT INTO events_outbox (event_type, event_version, payload, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [event.event_type, event.event_version, JSON.stringify(event)]
    );
    return rows[0].id;
  }

  /**
   * Publish multiple events atomically.
   */
  async publishBatch(events, client) {
    const ids = [];
    for (const event of events) {
      const id = await this.publish(event, client);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Fetch pending events for delivery (used by the background worker).
   */
  async getPendingEvents(limit = 100) {
    const { rows } = await pool.query(
      `SELECT * FROM events_outbox
       WHERE status='pending' AND attempts < 5
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  /**
   * Mark an event as delivered.
   */
  async markDelivered(eventId) {
    await pool.query(
      `UPDATE events_outbox SET status='delivered', delivered_at=NOW() WHERE id=$1`,
      [eventId]
    );
  }

  /**
   * Record a delivery failure and increment the attempt counter.
   */
  async markFailed(eventId, error) {
    await pool.query(
      `UPDATE events_outbox SET attempts=attempts+1, last_error=$1,
       status=CASE WHEN attempts+1 >= 5 THEN 'failed' ELSE 'pending' END
       WHERE id=$2`,
      [String(error).slice(0, 500), eventId]
    );
  }
}

const eventPublisher = new EventPublisher();

module.exports = { EventPublisher, eventPublisher };
