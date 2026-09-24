export type OutreachMode = 'off' | 'test' | 'live';

export type PrimaryTab =
  | 'overview'
  | 'prospects'
  | 'approvals'
  | 'campaigns'
  | 'inbox'
  | 'customers'
  | 'analytics'
  | 'settings';

/** @deprecated Use 'overview' — kept for NavigateFilters / URL compat */
export type LegacyPrimaryTab = 'acquisition';

export interface NorthStars {
  /** Preferred: new signups */
  newSignups?: number;
  activatedUsers?: number;
  payingCustomers?: number;
  creditPurchases?: number;
  revenueCents?: number;
  /** Legacy aliases */
  customersAcquired?: number;
  activeUsersAcquired?: number;
  revenueAttributedCents?: number;
  referralSignups?: number;
}

export interface FunnelCounts {
  discovered?: number;
  contactable?: number;
  approved?: number;
  sent?: number;
  clicked?: number;
  signedUp?: number;
  activated?: number;
  buyers?: number;
  revenue?: number;
  /** Legacy / optional */
  qualified?: number;
  contactNeeded?: number;
  drafts?: number;
  awaitingApproval?: number;
  scheduled?: number;
  contacted?: number;
  replied?: number;
  interested?: number;
  partners?: number;
  [key: string]: number | undefined;
}

export interface ConversionRates {
  discoveredToQualified?: number;
  qualifiedToContacted?: number;
  contactedToReplied?: number;
  repliedToInterested?: number;
  interestedToPartner?: number;
  draftToApproved?: number;
  approvedToSent?: number;
  discoveredToContactable?: number;
  contactableToApproved?: number;
  approvedToSentRate?: number;
  sentToClicked?: number;
  clickedToSignedUp?: number;
  signedUpToActivated?: number;
  activatedToBuyers?: number;
  [key: string]: number | undefined;
}

export interface TodaysAction {
  key: string;
  label: string;
  count: number;
  filter: string;
}

export interface DashboardSettingsSnapshot {
  outreachMode: OutreachMode | string;
  pauseAllOutreach: boolean;
  complaintPause: boolean;
  sendEnabled: boolean;
}

export interface AcquisitionSourceRow {
  key?: string;
  label?: string;
  source?: string;
  emails?: number;
  sent?: number;
  signups?: number;
  activated?: number;
  revenue?: number;
  revenueCents?: number;
  prospects?: number;
}

export interface AcquisitionDashboard {
  northStars: NorthStars;
  funnel: FunnelCounts;
  conversionRates?: ConversionRates;
  todaysActions: TodaysAction[];
  settings: DashboardSettingsSnapshot;
  sources?: AcquisitionSourceRow[];
  topSources?: AcquisitionSourceRow[];
  acquisitionSources?: AcquisitionSourceRow[];
}

export interface NextActionInfo {
  key?: string;
  label?: string;
  primaryButton?: string;
}

export interface PartnerProspect {
  prospectId: string;
  organizationName: string;
  organizationType?: string;
  prospectType?: string;
  /** Normalized kind: GYM | STUDIO | SPORTS_CLUB | RUN_CLUB | … */
  prospectKind?: string;
  entityType?: string;
  website?: string;
  email?: string;
  emailSource?: string;
  contactName?: string;
  contactRole?: string;
  phone?: string;
  country?: string;
  region?: string;
  city?: string;
  metro?: string;
  campaignLanguage?: string;
  mode?: string;
  campaignId?: string;
  activity?: string;
  sourceUrl?: string;
  partnerCode?: string;
  landingUrl?: string;
  status?: string;
  crmLifecycle?: string;
  contactState?: string;
  emailState?: string;
  /** CONTACT_NEEDED | RESEARCHING | CONTACT_FOUND | NO_PUBLIC_CONTACT | RETRY_LATER | MANUAL_REVIEW */
  contactabilityState?: string;
  contactabilityScore?: number;
  contactSourceUrl?: string;
  contactSourceType?: string;
  researchAttempts?: number;
  lastResearchAt?: string;
  nextResearchAt?: string;
  /** Public contact form found when the site exposes no email. */
  contactFormUrl?: string;
  /** HIGH | MEDIUM | LOW */
  contactConfidence?: string;
  /** CONTACT_NEEDED | RESEARCHING | EMAIL_FOUND | CONTACT_FORM_FOUND | REVIEW_REQUIRED | NO_PUBLIC_CONTACT | MANUAL_CONTACT */
  contactDiscoveryStatus?: string;
  lastContactResearchAt?: string;
  lastContactResearchSummary?: string;
  /** Medium-confidence candidate awaiting admin accept/reject — never used for sending. */
  pendingReviewEmail?: string;
  pendingReviewSourceUrl?: string;
  pendingReviewConfidence?: string;
  notes?: string;
  whySelected?: string;
  fitScore?: number;
  acquisitionScore?: number;
  audienceFitScore?: number;
  marketRelevanceScore?: number;
  communityFitScore?: number;
  contactQualityScore?: number;
  historicalCategoryScore?: number;
  /** Optional activity component when API provides it */
  activityScore?: number;
  strategicScore?: number;
  scoreExplanation?: string;
  discoverySource?: string;
  emailVerificationStatus?: string;
  acquisitionStatus?: string;
  customerStatus?: string;
  distributionStatus?: string;
  partnershipStatus?: string;
  referralSignups?: number;
  activatedUsers?: number;
  paidCustomers?: number;
  attributedRevenueCents?: number;
  directRevenueCents?: number;
  signupAt?: string;
  activatedAt?: string;
  firstPurchaseAt?: string;
  timelineJson?: string;
  nextAction?: NextActionInfo | string;
  whyNotSent?: string;
  relevantModes?: string[];
  prospectCategory?: string;
  qualificationScore?: number;
  qualificationReasons?: string;
  createdAt?: string;
  lastContactedAt?: string;
  lastActiveAt?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedInUrl?: string;
}

export interface AcquisitionCustomer {
  prospectId?: string;
  customerId?: string;
  name?: string;
  organizationName?: string;
  entityType?: string;
  prospectType?: string;
  source?: string;
  discoverySource?: string;
  campaignId?: string;
  campaignName?: string;
  signupAt?: string;
  activatedAt?: string;
  customerStatus?: string;
  referralSignups?: number;
  activatedUsers?: number;
  paidCustomers?: number;
  creditPurchases?: number;
  buyers?: number;
  attributedRevenueCents?: number;
  directRevenueCents?: number;
  revenueCents?: number;
  lastActiveAt?: string;
  lastContactedAt?: string;
}

export interface PartnerQueueItem {
  queueId: string;
  approvalId?: string;
  prospectId?: string;
  campaignId?: string;
  recipient: string;
  organizationName: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  partnerUrl?: string;
  status: string;
  followUpNumber?: number;
  scheduledAt?: string;
  createdAt?: string;
  sentAt?: string;
  sesMessageId?: string;
  approvedAt?: string;
  lastError?: string;
}

export interface PartnerCampaign {
  campaignId: string;
  name?: string;
  displayName?: string;
  status: string;
  country?: string;
  market?: string;
  primaryMode?: string;
  languages?: string[];
  categories?: string[];
  dailyDiscoveryLimit?: number;
  dailyOutreachLimit?: number;
  minAcquisitionScore?: number;
  allocationPercent?: number;
  timezone?: string;
}

export interface PartnerThread {
  threadId: string;
  prospectId?: string;
  queueId?: string;
  subject?: string;
  lastMessageAt?: string;
  messageCount?: number;
}

export interface PartnerMessage {
  threadId: string;
  messageId: string;
  direction: string;
  from?: string;
  to?: string;
  subject?: string;
  bodyText?: string;
  bodyHtmlSafe?: string;
  deliveryStatus?: string;
  createdAt?: string;
}

export interface OutreachSettings {
  id?: string;
  outreachMode: OutreachMode | string;
  pauseAllOutreach: boolean;
  testRecipientsOnly?: boolean;
  testRecipients?: string[];
  prospectsPerRun?: number;
  researchAttemptsPerRun?: number;
  researchContactsPerRun?: number;
  draftsPerRun?: number;
  keepPipelineFull?: boolean;
  targetProspectInventory?: number;
  complaintPause?: boolean;
  sentCount?: number;
  bounceCount?: number;
  complaintCount?: number;
  replyCount?: number;
  sendEnabled?: boolean;
  dailyLimit?: number;
  sentToday?: number;
  remaining?: number;
  automaticSending?: boolean;
  dryRun?: boolean;
  autoDiscoverProspects?: boolean;
  autoDiscoverContacts?: boolean;
  autoPrepareMessages?: boolean;
  followUpsEnabled?: boolean;
  sendQualifiedAutomatically?: boolean;
  sesMax24HourSend?: number | null;
  sesSentLast24Hours?: number | null;
  sesRemaining?: number | null;
  effectiveRemaining?: number;
  deliveredTracking?: string;
}

export interface DiscoveryJob {
  jobId: string;
  status: string;
  stage?: string;
  progressPct?: number;
  processed?: number;
  total?: number;
  error?: string;
  prospectsFound?: number;
  draftsCreated?: number;
  contactsFound?: number;
  completedAt?: string;
  reportJson?: string;
}

export interface OutreachMetrics {
  approvedRecipients?: number;
  sent?: number;
  delivered?: number;
  bounced?: number;
  complaints?: number;
  replies?: number;
  positiveReplies?: string | number;
  partnerLandingSessions?: string | number;
  partnerAttributedSignups?: string | number;
  sendEnabled?: boolean;
  complaintPause?: boolean;
  outreachMode?: string;
  pauseAllOutreach?: boolean;
  organizationsDiscovered?: number;
  qualifiedOrganizations?: number;
  verifiedPublicContacts?: number;
  contactsUnavailable?: number;
  draftsGenerated?: number;
  approvalReadyRecipients?: number;
}

export interface ProspectFilters {
  market?: string;
  category?: string;
  prospectType?: string;
  scoreMin?: number;
  contactAvailable?: 'any' | 'available' | 'needed';
  lifecycle?: string;
  search?: string;
  contactState?: string;
  status?: string;
}

export interface PanelSharedProps {
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
  refreshKey: number;
  requestRefresh: () => void;
}

export interface NavigateFilters {
  tab: PrimaryTab | LegacyPrimaryTab;
  prospectFilters?: ProspectFilters;
  approvalsStatus?: string;
}

export interface ProspectDetailResponse {
  prospect?: PartnerProspect;
  whyNotSent?: string;
  nextAction?: NextActionInfo | string;
  timeline?: Array<{ at?: string; type?: string; note?: string; label?: string; eventKey?: string }>;
  queue?: PartnerQueueItem[];
  queueItems?: PartnerQueueItem[];
}
