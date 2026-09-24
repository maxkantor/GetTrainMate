/**
 * Owner actions from live Partner CRM state.
 * Automation performs discovery / contact research / qualified sends.
 * Only surface MAX — ACTION REQUIRED when the owner must fix something automation cannot.
 */

export const CONTACTS_ADMIN_URL = 'https://gettrainmate.com/admin/partner-outreach?tab=prospects';
export const APPROVALS_ADMIN_URL = 'https://gettrainmate.com/admin/partner-outreach?tab=approvals';
export const SETTINGS_ADMIN_URL = 'https://gettrainmate.com/admin/partner-outreach?tab=settings';

export const AUTOMATION_HEALTHY =
  'Partner acquisition automation is operating normally. No owner action required.';

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
 *   automaticSending?: boolean,
 *   autoDiscoverContacts?: boolean,
 *   autoDiscoverProspects?: boolean,
 *   sendQualifiedAutomatically?: boolean,
 *   dryRun?: boolean,
 *   safetyPaused?: boolean,
 *   complaintPause?: boolean,
 *   sesAuthFailed?: boolean,
 *   discoveryUnavailable?: boolean,
 *   crmUnavailable?: boolean,
 *   crmReason?: string,
 * }} state
 */
export function buildOwnerActions(state = {}) {
  const automatic = Boolean(state.automaticSending);
  const autoContacts = state.autoDiscoverContacts !== false;
  const autoSend = state.sendQualifiedAutomatically !== false;
  const paused = Boolean(state.pauseAllOutreach);
  const safetyPaused = Boolean(state.safetyPaused || state.complaintPause);
  const actions = [];

  if (state.crmUnavailable) {
    actions.push({
      id: 'crm',
      severity: 'required',
      text: `MAX — ACTION REQUIRED: Partner CRM unavailable. ${state.crmReason || 'Fix credentials / API access.'}`,
    });
    return actions;
  }

  if (state.sesAuthFailed) {
    actions.push({
      id: 'ses',
      severity: 'required',
      text: 'MAX — ACTION REQUIRED: SES authentication or configuration failed.',
    });
  }

  if (state.discoveryUnavailable) {
    actions.push({
      id: 'discovery-provider',
      severity: 'required',
      text: 'MAX — ACTION REQUIRED: no discovery provider/API available.',
    });
  }

  if (safetyPaused) {
    actions.push({
      id: 'safety',
      severity: 'required',
      text: 'MAX — ACTION REQUIRED: AUTOMATIC SENDING PAUSED — deliverability safety threshold exceeded. Review bounce/complaint rates in Admin → Settings.',
      href: SETTINGS_ADMIN_URL,
      cta: 'OPEN SETTINGS',
    });
  }

  if (paused) {
    actions.push({
      id: 'pause',
      severity: 'required',
      text: 'MAX — ACTION REQUIRED: campaign is intentionally paused. Resume in Admin → Settings only if that was not intended.',
      href: SETTINGS_ADMIN_URL,
      cta: 'OPEN SETTINGS',
    });
  }

  if (automatic && state.dryRun) {
    actions.push({
      id: 'dry-run',
      severity: 'required',
      text: 'MAX — ACTION REQUIRED: Dry Run is ON. Automatic sending will not call SES until Dry Run is turned OFF.',
      href: SETTINGS_ADMIN_URL,
      cta: 'OPEN SETTINGS',
    });
  }

  const needContact = n(state.needContact);
  const awaitingApproval = n(state.awaitingApproval);
  const approvedEligible = n(state.approvedEligible ?? state.recipientsApproved);

  if (!automatic || !autoContacts) {
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
  }

  if (!automatic || !autoSend) {
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
  }

  if (!actions.length) {
    actions.push({
      id: 'none',
      text: automatic ? AUTOMATION_HEALTHY : 'No outreach action required.',
    });
  }

  return actions;
}

/** Single primary line for report / CRM snapshot. */
export function ownerActionSummary(state = {}) {
  const actions = buildOwnerActions(state);
  return actions[0]?.text || AUTOMATION_HEALTHY;
}

export function ownerActionMentionsApprovals(text) {
  return /OPEN APPROVALS|Approvals\s*→\s*APPROVE|waiting for approval/i.test(String(text || ''));
}

export function ownerActionRequiresMax(actions) {
  return (actions || []).some((a) => a.severity === 'required' || /^MAX — ACTION REQUIRED/i.test(a.text || ''));
}
