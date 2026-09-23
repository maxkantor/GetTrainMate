/**
 * Owner actions from live Partner CRM state.
 * Never mention Approvals when awaitingApproval = 0.
 */

export const CONTACTS_ADMIN_URL = 'https://gettrainmate.com/admin/partner-outreach?tab=prospects';
export const APPROVALS_ADMIN_URL = 'https://gettrainmate.com/admin/partner-outreach?tab=approvals';

function n(value) {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

/**
 * @param {{
 *   needContact?: number,
 *   awaitingApproval?: number,
 *   approvedEligible?: number,
 *   recipientsApproved?: number,
 *   pauseAllOutreach?: boolean,
 * }} state
 */
export function buildOwnerActions(state = {}) {
  const needContact = n(state.needContact);
  const awaitingApproval = n(state.awaitingApproval);
  const approvedEligible = n(state.approvedEligible ?? state.recipientsApproved);
  const paused = Boolean(state.pauseAllOutreach);
  const actions = [];

  if (paused) {
    actions.push({
      id: 'pause',
      text: 'Emergency pause is on. Resume in Admin → Customer Acquisition → Settings only for emergencies.',
    });
  }

  if (needContact > 0) {
    actions.push({
      id: 'discover',
      text:
        needContact === 1
          ? 'Discover contacts for 1 prospect.'
          : `Discover contacts for ${needContact} prospects.`,
      detail: `${needContact} prospect${needContact === 1 ? '' : 's'} need contact discovery.`,
      href: CONTACTS_ADMIN_URL,
      cta: 'DISCOVER CONTACTS',
    });
  }

  if (awaitingApproval > 0) {
    actions.push({
      id: 'approve',
      text:
        awaitingApproval === 1
          ? '1 outreach draft is waiting for approval.'
          : `${awaitingApproval} outreach drafts are waiting for approval.`,
      href: APPROVALS_ADMIN_URL,
      cta: 'OPEN APPROVALS',
    });
  }

  if (approvedEligible > 0) {
    actions.push({
      id: 'send',
      text:
        approvedEligible === 1
          ? '1 approved prospect is ready to send.'
          : `${approvedEligible} approved prospects are ready to send.`,
    });
  }

  if (!actions.length) {
    actions.push({
      id: 'none',
      text: 'No outreach action required.',
    });
  }

  return actions;
}

/** Single primary line for report / CRM snapshot. */
export function ownerActionSummary(state = {}) {
  const actions = buildOwnerActions(state);
  return actions[0]?.text || 'No outreach action required.';
}

export function ownerActionMentionsApprovals(text) {
  return /OPEN APPROVALS|Approvals\s*→\s*APPROVE|waiting for approval/i.test(String(text || ''));
}
