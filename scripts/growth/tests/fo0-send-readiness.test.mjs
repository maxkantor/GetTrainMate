import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOMATION_HEALTHY,
  buildOwnerActions,
  gatedInventoryIdleMessage,
  ownerActionSummary,
} from '../lib/owner-actions.mjs';
import { composeGrowthEmailBody } from '../lib/growth-report.mjs';

/**
 * Mirrors Fo0SendReadiness.ClassifyFromGateCodes / WhyNotSent.FromGateCode for report agreement tests.
 */
function classifyFromGateCodes(codes) {
  const blockedByReason = Object.create(null);
  let inventory = 0;
  let sendable = 0;
  for (const code of codes) {
    inventory++;
    if (code == null) {
      sendable++;
      continue;
    }
    const reason =
      code === 'duplicate_organization'
        ? 'DUPLICATE_ORGANIZATION'
        : code === 'duplicate_recipient'
          ? 'DUPLICATE_EMAIL'
          : String(code).toUpperCase();
    blockedByReason[reason] = (blockedByReason[reason] || 0) + 1;
  }
  return {
    inventoryDrafts: inventory,
    sendableNow: sendable,
    inventoryBlocked: inventory - sendable,
    allInventoryGated: inventory > 0 && sendable === 0,
    sendGateSkips: blockedByReason,
  };
}

describe('FO0 inventory vs sendable reporting (Nov 2 scenario)', () => {
  const nov2Codes = [
    ...Array(27).fill('duplicate_organization'),
    ...Array(3).fill('duplicate_recipient'),
  ];

  it('classifies 30 inventory / 27 org / 3 recipient / 0 sendable', () => {
    const r = classifyFromGateCodes(nov2Codes);
    assert.equal(r.inventoryDrafts, 30);
    assert.equal(r.sendableNow, 0);
    assert.equal(r.inventoryBlocked, 30);
    assert.equal(r.sendGateSkips.DUPLICATE_ORGANIZATION, 27);
    assert.equal(r.sendGateSkips.DUPLICATE_EMAIL, 3);
    assert.equal(r.allInventoryGated, true);
  });

  it('owner actions and daily report agree: gated inventory is not a technical defect', () => {
    const r = classifyFromGateCodes(nov2Codes);
    const partnerOutreach = {
      status: 'ok',
      autoEligible: r.inventoryDrafts,
      inventoryDrafts: r.inventoryDrafts,
      sendableNow: r.sendableNow,
      inventoryBlocked: r.inventoryBlocked,
      allInventoryGated: r.allInventoryGated,
      sendGateSkips: r.sendGateSkips,
      emailsSentToday: 0,
      emailsSent: 290,
      delivered: 38,
      humanReview: 0,
      recipientsApproved: r.inventoryDrafts,
      alreadyContactedQualified: 10,
      contactNeeded: 5,
      settings: {
        automaticSending: true,
        dryRun: false,
        pauseAllOutreach: false,
        complaintPause: false,
        sendQualifiedAutomatically: true,
        deliveredTracking: 'CONFIGURED',
        dailyLimit: 100,
      },
      funnel: {
        autoEligible: r.inventoryDrafts,
        inventoryDrafts: r.inventoryDrafts,
        sendableNow: r.sendableNow,
        inventoryBlocked: r.inventoryBlocked,
        allInventoryGated: r.allInventoryGated,
        sendGateSkips: r.sendGateSkips,
      },
      ownerActions: buildOwnerActions({
        automaticSending: true,
        sendQualifiedAutomatically: true,
        dryRun: false,
        autoEligible: r.inventoryDrafts,
        inventoryDrafts: r.inventoryDrafts,
        sendableNow: r.sendableNow,
        emailsSentToday: 0,
      }),
      ownerAction: ownerActionSummary({
        automaticSending: true,
        sendQualifiedAutomatically: true,
        dryRun: false,
        autoEligible: r.inventoryDrafts,
        inventoryDrafts: r.inventoryDrafts,
        sendableNow: r.sendableNow,
        emailsSentToday: 0,
      }),
    };

    assert.equal(partnerOutreach.ownerActions[0].id, 'none');
    assert.equal(partnerOutreach.ownerAction, AUTOMATION_HEALTHY);

    const { text } = composeGrowthEmailBody({
      snapshot: {
        partnerOutreach,
        ownedSocial: { facebook: { published: true }, instagram: { published: true } },
      },
      notes: 'reporting-correction-test',
    });
    assert.match(text, /inventory_drafts=30/);
    assert.match(text, /sendable_now=0/);
    assert.match(text, /PIPELINE: inventory=30 sendable=0/);
    assert.doesNotMatch(text, /MAX — ACTION REQUIRED:.*0 SES accepts today despite 30/);
    assert.match(text, /operating normally|No owner action required|HEALTHY/i);
    assert.match(
      gatedInventoryIdleMessage({
        inventoryDrafts: 30,
        sendableNow: 0,
        emailsSentToday: 0,
      }),
      /not a technical send-path defect/,
    );
  });

  it('still alarms when sendableNow > 0 and SES accepts are zero', () => {
    const actions = buildOwnerActions({
      automaticSending: true,
      sendQualifiedAutomatically: true,
      dryRun: false,
      inventoryDrafts: 30,
      autoEligible: 30,
      sendableNow: 5,
      emailsSentToday: 0,
    });
    assert.equal(actions[0].id, 'zero-sends-despite-eligible');
  });
});
