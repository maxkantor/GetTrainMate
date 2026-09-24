import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOMATION_HEALTHY,
  buildOwnerActions,
  ownerActionSummary,
  ownerActionMentionsApprovals,
  ownerActionRequiresMax,
} from '../lib/owner-actions.mjs';

describe('buildOwnerActions', () => {
  it('does not ask Max to discover contacts when automation is ON', () => {
    const actions = buildOwnerActions({
      needContact: 10,
      awaitingApproval: 0,
      approvedEligible: 0,
      automaticSending: true,
      autoDiscoverContacts: true,
      sendQualifiedAutomatically: true,
    });
    assert.equal(actions.length, 1);
    assert.equal(actions[0].id, 'none');
    assert.equal(actions[0].text, AUTOMATION_HEALTHY);
    assert.equal(ownerActionMentionsApprovals(actions[0].text), false);
    assert.equal(ownerActionRequiresMax(actions), false);
    assert.equal(
      ownerActionSummary({ needContact: 10, awaitingApproval: 0, automaticSending: true }),
      AUTOMATION_HEALTHY,
    );
  });

  it('asks for contact discovery only when automation is OFF', () => {
    const actions = buildOwnerActions({
      needContact: 10,
      awaitingApproval: 0,
      approvedEligible: 0,
      automaticSending: false,
    });
    assert.equal(actions[0].id, 'discover');
    assert.match(actions[0].text, /Discover contacts for 10 prospects/);
    assert.equal(actions[0].cta, 'DISCOVER CONTACTS');
  });

  it('mentions Approvals only when awaitingApproval > 0 and automation is OFF', () => {
    const actions = buildOwnerActions({
      needContact: 0,
      awaitingApproval: 9,
      approvedEligible: 0,
      automaticSending: false,
    });
    assert.equal(actions[0].id, 'approve');
    assert.match(actions[0].text, /9 outreach drafts are waiting for approval/);
    assert.equal(actions[0].cta, 'OPEN APPROVALS');
  });

  it('does not ask for approval when automatic sending is ON', () => {
    const actions = buildOwnerActions({
      needContact: 0,
      awaitingApproval: 9,
      approvedEligible: 3,
      automaticSending: true,
      sendQualifiedAutomatically: true,
    });
    assert.equal(actions[0].id, 'none');
    assert.equal(actions[0].text, AUTOMATION_HEALTHY);
  });

  it('reports ready-to-send when approved and automation is OFF', () => {
    const actions = buildOwnerActions({
      needContact: 0,
      awaitingApproval: 0,
      approvedEligible: 3,
      automaticSending: false,
    });
    assert.equal(actions[0].id, 'send');
    assert.match(actions[0].text, /3 approved prospects are ready to send/);
    assert.equal(ownerActionMentionsApprovals(actions[0].text), false);
  });

  it('returns healthy automation when the pipeline is idle and automatic', () => {
    const actions = buildOwnerActions({
      needContact: 0,
      awaitingApproval: 0,
      approvedEligible: 0,
      automaticSending: true,
    });
    assert.equal(actions[0].id, 'none');
    assert.equal(actions[0].text, AUTOMATION_HEALTHY);
  });

  it('flags real owner-required conditions', () => {
    const paused = buildOwnerActions({
      automaticSending: true,
      pauseAllOutreach: true,
    });
    assert.equal(ownerActionRequiresMax(paused), true);
    assert.match(paused[0].text, /MAX — ACTION REQUIRED/);

    const dry = buildOwnerActions({
      automaticSending: true,
      dryRun: true,
    });
    assert.equal(ownerActionRequiresMax(dry), true);
    assert.match(dry[0].text, /Dry Run is ON/);
  });
});
