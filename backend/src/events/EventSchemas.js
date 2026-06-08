/**
 * Canonical event type constants and schema factories for all RemitBridge events.
 * FlowIndexer consumes these; maintain backwards compatibility on schema changes.
 */

const EVENT_VERSION = '1.0';

const EventTypes = Object.freeze({
  // Payroll / Batch
  PAYROLL_CREATED: 'remitbridge.payroll.created',
  PAYROLL_APPROVED: 'remitbridge.payroll.approved',
  PAYROLL_EXECUTED: 'remitbridge.payroll.executed',
  PAYROLL_FAILED: 'remitbridge.payroll.failed',
  PAYROLL_CANCELLED: 'remitbridge.payroll.cancelled',

  // Transfers / Payments
  TRANSFER_INITIATED: 'remitbridge.transfer.initiated',
  TRANSFER_SETTLED: 'remitbridge.transfer.settled',
  TRANSFER_FAILED: 'remitbridge.transfer.failed',
  TRANSFER_CLAWBACK: 'remitbridge.transfer.clawback',

  // Anchor / Cash-out
  ANCHOR_CASHOUT_INITIATED: 'remitbridge.anchor.cashout_initiated',
  ANCHOR_CASHOUT_COMPLETED: 'remitbridge.anchor.cashout_completed',
  ANCHOR_CASHOUT_FAILED: 'remitbridge.anchor.cashout_failed',

  // Recipients
  BENEFICIARY_CREATED: 'remitbridge.beneficiary.created',
  BENEFICIARY_UPDATED: 'remitbridge.beneficiary.updated',
  BENEFICIARY_KYC_APPROVED: 'remitbridge.beneficiary.kyc_approved',
  BENEFICIARY_KYC_REJECTED: 'remitbridge.beneficiary.kyc_rejected',

  // Compliance
  COMPLIANCE_CHECK_COMPLETED: 'remitbridge.compliance.check_completed',
  COMPLIANCE_FLAG_RAISED: 'remitbridge.compliance.flag_raised',
  SANCTIONS_MATCH_FOUND: 'remitbridge.compliance.sanctions_match',

  // Aid Programs
  AID_PROGRAM_CREATED: 'remitbridge.aid.program_created',
  AID_DISBURSEMENT_COMPLETED: 'remitbridge.aid.disbursement_completed',

  // Organization
  ORG_CREATED: 'remitbridge.org.created',
  ORG_TRUSTFLOW_LINKED: 'remitbridge.org.trustflow_linked',

  // TrustFlow integration
  TRUSTFLOW_ALLOCATION_CONSUMED: 'remitbridge.trustflow.allocation_consumed',
  TRUSTFLOW_ALLOCATION_SYNCED: 'remitbridge.trustflow.allocation_synced',
});

function makeEvent(type, payload, meta = {}) {
  return {
    event_type: type,
    event_version: meta.version || EVENT_VERSION,
    source: 'remitbridge',
    timestamp: new Date().toISOString(),
    idempotency_key: meta.idempotencyKey || null,
    payload,
  };
}

const Schemas = {
  payrollCreated(batch, orgId) {
    return makeEvent(EventTypes.PAYROLL_CREATED, {
      batch_id: batch.id,
      org_id: orgId,
      type: batch.type,
      total_amount: batch.total_amount,
      currency: batch.currency,
      recipient_count: batch.recipient_count,
      trustflow_allocation_id: batch.trustflow_allocation_id || null,
    });
  },

  payrollExecuted(batch, orgId, successCount, failCount) {
    return makeEvent(EventTypes.PAYROLL_EXECUTED, {
      batch_id: batch.id,
      org_id: orgId,
      type: batch.type,
      total_amount: batch.total_amount,
      currency: batch.currency,
      status: batch.status,
      success_count: successCount,
      fail_count: failCount,
    });
  },

  transferSettled(payment, batchId, orgId) {
    return makeEvent(EventTypes.TRANSFER_SETTLED, {
      payment_id: payment.id,
      batch_id: batchId,
      org_id: orgId,
      stellar_address: payment.stellar_address,
      amount: payment.amount,
      currency: payment.currency,
      tx_hash: payment.tx_hash,
    });
  },

  transferFailed(payment, batchId, orgId) {
    return makeEvent(EventTypes.TRANSFER_FAILED, {
      payment_id: payment.id,
      batch_id: batchId,
      org_id: orgId,
      stellar_address: payment.stellar_address,
      amount: payment.amount,
      currency: payment.currency,
      error: payment.error_msg,
    });
  },

  transferClawback(payment, batchId, orgId) {
    return makeEvent(EventTypes.TRANSFER_CLAWBACK, {
      payment_id: payment.id,
      batch_id: batchId,
      org_id: orgId,
      amount: payment.amount,
      currency: payment.currency,
    });
  },

  beneficiaryCreated(recipient, orgId) {
    return makeEvent(EventTypes.BENEFICIARY_CREATED, {
      recipient_id: recipient.id,
      org_id: orgId,
      country: recipient.country,
      kyc_status: recipient.kyc_status,
    });
  },

  complianceCheckCompleted(record, orgId) {
    return makeEvent(EventTypes.COMPLIANCE_CHECK_COMPLETED, {
      compliance_record_id: record.id,
      org_id: orgId,
      recipient_id: record.recipient_id,
      check_type: record.check_type,
      status: record.status,
      risk_score: record.risk_score,
    });
  },

  aidProgramCreated(program, orgId) {
    return makeEvent(EventTypes.AID_PROGRAM_CREATED, {
      program_id: program.id,
      org_id: orgId,
      program_type: program.program_type,
      region: program.region,
      country: program.country,
      budget_total: program.budget_total,
      currency: program.currency,
    });
  },

  orgCreated(org) {
    return makeEvent(EventTypes.ORG_CREATED, {
      org_id: org.id,
      name: org.name,
      country: org.country,
      use_case: org.use_case,
    });
  },

  trustflowAllocationConsumed(allocationId, orgId, batchId, amount, currency) {
    return makeEvent(EventTypes.TRUSTFLOW_ALLOCATION_CONSUMED, {
      allocation_id: allocationId,
      org_id: orgId,
      batch_id: batchId,
      consumed_amount: amount,
      currency,
    });
  },
};

module.exports = { EventTypes, Schemas, EVENT_VERSION };
