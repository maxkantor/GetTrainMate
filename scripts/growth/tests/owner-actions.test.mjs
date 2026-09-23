import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOwnerActions,
  ownerActionSummary,
  ownerActionMentionsApprovals,
} from '../lib/owner-actions.mjs';

describe('buildOwnerActions', () => {
  it('asks for contact discovery when needContact > 0 and never mentions Approvals', () => {
    const actions = buildOwnerActions({
      needContact: 10,
      awaitingApproval: 0,
      approvedEligible: 0,
    });
    assert.equal(actions.length, 1);
    assert.equal(actions[0].id, 'discover');
    assert.match(actions[0].text, /Discover contacts for 10 prospects/);
    assert.equal(actions[0].cta, 'DISCOVER CONTACTS');
    assert.equal(ownerActionMentionsApprovals(actions[0].text), false);
    assert.equal(ownerActionSummary({ needContact: 10, awaitingApproval: 0 }), 'Discover contacts for 10 prospects.');
  });

  it('mentions Approvals only when awaitingApproval > 0', () => {
    const actions = buildOwnerActions({
      needContact: 0,
      awaitingApproval: 9,
      approvedEligible: 0,
    });
    assert.equal(actions[0].id, 'approve');
    assert.match(actions[0].text, /9 outreach drafts are waiting for approval/);
    assert.equal(actions[0].cta, 'OPEN APPROVALS');
  });

  it('reports ready-to-send when approved and nothing else is pending', () => {
    const actions = buildOwnerActions({
      needContact: 0,
      awaitingApproval: 0,
      approvedEligible: 3,
    });
    assert.equal(actions[0].id, 'send');
    assert.match(actions[0].text, /3 approved prospects are ready to send/);
    assert.equal(ownerActionMentionsApprovals(actions[0].text), false);
  });

  it('returns no outreach action when the pipeline is idle', () => {
    const actions = buildOwnerActions({
      needContact: 0,
      awaitingApproval: 0,
      approvedEligible: 0,
    });
    assert.equal(actions[0].id, 'none');
    assert.equal(actions[0].text, 'No outreach action required.');
  });
});
