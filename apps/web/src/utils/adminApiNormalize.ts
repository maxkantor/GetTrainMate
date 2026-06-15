/**
 * ASP.NET may serialize JSON as camelCase; older clients or proxies may expose PascalCase.
 * Admin pages use these helpers so lists never disappear due to `items` vs `Items`.
 */

export function pickPagedItems<T>(raw: unknown): T[] {
  if (raw == null || typeof raw !== 'object') return [];
  const o = raw as Record<string, unknown>;
  const items = o.items ?? o.Items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export function pickPagedMeta(raw: unknown): { page: number; pageSize: number; totalPages: number; totalCount: number } {
  if (raw == null || typeof raw !== 'object') {
    return { page: 1, pageSize: 50, totalPages: 1, totalCount: 0 };
  }
  const o = raw as Record<string, unknown>;
  const page = Number(o.page ?? o.Page ?? 1) || 1;
  const pageSize = Number(o.pageSize ?? o.PageSize ?? 50) || 50;
  const totalCount = Number(o.totalCount ?? o.TotalCount ?? 0) || 0;
  let totalPages = Number(o.totalPages ?? o.TotalPages ?? 0) || 0;
  if (totalPages < 1 && totalCount > 0) {
    totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  }
  if (totalPages < 1) totalPages = 1;
  return { page, pageSize, totalPages, totalCount };
}

/** Normalize dashboard metrics payload (camelCase or PascalCase keys). */
/** Map a user row from admin API (camelCase or PascalCase keys). */
function pickStringList(o: Record<string, unknown>, camel: string, pascal: string): string[] {
  const raw = o[camel] ?? o[pascal];
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter((s) => s.length > 0);
}

export function normalizeAdminUserRow(raw: unknown): {
  userId: string;
  email: string;
  name: string;
  status: string;
  plan?: string;
  city?: string;
  state?: string;
  birthDate?: string;
  age?: number;
  createdAt: string;
  credits?: number;
  coverPhotoUrl?: string;
} {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const uid = String(o.userId ?? o.UserId ?? '');
  const created = o.createdAt ?? o.CreatedAt;
  const createdAt =
    created instanceof Date
      ? created.toISOString()
      : typeof created === 'string'
        ? created
        : new Date().toISOString();
  const cover =
    o.coverPhotoUrl != null || o.CoverPhotoUrl != null
      ? String(o.coverPhotoUrl ?? o.CoverPhotoUrl ?? '').trim() || undefined
      : undefined;
  return {
    userId: uid,
    email: String(o.email ?? o.Email ?? ''),
    name: String(o.name ?? o.Name ?? ''),
    status: String(o.status ?? o.Status ?? ''),
    plan: (o.plan ?? o.Plan) != null ? String(o.plan ?? o.Plan) : undefined,
    city: (o.city ?? o.City) != null ? String(o.city ?? o.City) : undefined,
    state: (o.state ?? o.State) != null ? String(o.state ?? o.State) : undefined,
    birthDate: (o.birthDate ?? o.BirthDate) != null ? String(o.birthDate ?? o.BirthDate) : undefined,
    age:
      o.age != null || o.Age != null
        ? Number(o.age ?? o.Age ?? 0) || undefined
        : undefined,
    createdAt,
    credits:
      o.credits != null || o.Credits != null
        ? Number(o.credits ?? o.Credits ?? 0) || 0
        : undefined,
    ...(cover ? { coverPhotoUrl: cover } : {}),
  };
}

/** Full user detail from GET /api/admin/users/{id}. */
export function normalizeAdminUserDetail(raw: unknown): {
  userId: string;
  email: string;
  name: string;
  status: string;
  plan?: string;
  city?: string;
  state?: string;
  birthDate?: string;
  age?: number;
  createdAt: string;
  credits: number;
  lifetimeEarned: number;
  unlimitedDiscovery: boolean;
  emailReleasedForSignup?: boolean;
  bio?: string;
  photoUrls: string[];
  photoPreviewUrls: string[];
} {
  const base = normalizeAdminUserRow(raw);
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const er =
    o.emailReleasedForSignup != null || o.EmailReleasedForSignup != null
      ? Boolean(o.emailReleasedForSignup ?? o.EmailReleasedForSignup)
      : undefined;
  const photos = pickStringList(o, 'photoUrls', 'PhotoUrls');
  const previews = pickStringList(o, 'photoPreviewUrls', 'PhotoPreviewUrls');
  const bioRaw = o.bio ?? o.Bio;
  const bio = bioRaw != null && String(bioRaw).trim() ? String(bioRaw).trim() : undefined;
  return {
    ...base,
    credits: Number(o.credits ?? o.Credits ?? base.credits ?? 0) || 0,
    lifetimeEarned: Number(o.lifetimeEarned ?? o.LifetimeEarned ?? 0) || 0,
    unlimitedDiscovery: Boolean(o.unlimitedDiscovery ?? o.UnlimitedDiscovery ?? false),
    ...(er !== undefined ? { emailReleasedForSignup: er } : {}),
    ...(bio ? { bio } : {}),
    photoUrls: photos,
    photoPreviewUrls: previews.length >= photos.length ? previews : photos.map((_, i) => previews[i] ?? ''),
  };
}

export function normalizeAdminMetrics(raw: unknown): {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  totalMatches: number;
  totalMessages: number;
  totalEvents: number;
  premiumSubscriptions: number;
  revenue: number;
  orders7d: number;
  recentActivity: Array<{ type: string; description: string; timestamp: string }>;
} {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (a: unknown, b: unknown) => Number(a ?? b ?? 0) || 0;
  const dec = (a: unknown, b: unknown) => {
    const v = a ?? b;
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  };
  const ra = (o.recentActivity ?? o.RecentActivity) as unknown;
  const list = Array.isArray(ra) ? ra : [];
  const recentActivity = list.map((item) => {
    const x = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const ts = x.timestamp ?? x.Timestamp;
    return {
      type: String(x.type ?? x.Type ?? ''),
      description: String(x.description ?? x.Description ?? ''),
      timestamp: ts instanceof Date ? ts.toISOString() : String(ts ?? ''),
    };
  });
  return {
    totalUsers: num(o.totalUsers, o.TotalUsers),
    activeUsers: num(o.activeUsers, o.ActiveUsers),
    newUsers: num(o.newUsers, o.NewUsers),
    totalMatches: num(o.totalMatches, o.TotalMatches),
    totalMessages: num(o.totalMessages, o.TotalMessages),
    totalEvents: num(o.totalEvents, o.TotalEvents),
    premiumSubscriptions: num(o.premiumSubscriptions, o.PremiumSubscriptions),
    revenue: dec(o.revenue, o.Revenue),
    orders7d: num(o.orders7d, o.Orders7d),
    recentActivity,
  };
}

export function normalizeContactDetail(raw: unknown): {
  contactId: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
} {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const created = o.createdAt ?? o.CreatedAt;
  const updated = o.updatedAt ?? o.UpdatedAt;
  const notesRaw = o.notes ?? o.Notes;
  const phoneRaw = o.phone ?? o.Phone;
  return {
    contactId: String(o.contactId ?? o.ContactId ?? ''),
    name: String(o.name ?? o.Name ?? ''),
    email: String(o.email ?? o.Email ?? ''),
    phone: phoneRaw != null && String(phoneRaw).trim() ? String(phoneRaw).trim() : undefined,
    status: String(o.status ?? o.Status ?? 'active'),
    tags: pickStringList(o, 'tags', 'Tags'),
    notes: notesRaw != null && String(notesRaw).trim() ? String(notesRaw).trim() : undefined,
    createdAt:
      created instanceof Date
        ? created.toISOString()
        : typeof created === 'string'
          ? created
          : new Date().toISOString(),
    updatedAt:
      updated instanceof Date
        ? updated.toISOString()
        : typeof updated === 'string'
          ? updated
          : undefined,
  };
}

export function normalizeEmailThread(raw: unknown): {
  threadId: string;
  subject: string;
  lastMessageAt: string;
  lastFrom?: string;
  messageCount: number;
  status: string;
} {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const last = o.lastMessageAt ?? o.LastMessageAt;
  return {
    threadId: String(o.threadId ?? o.ThreadId ?? ''),
    subject: String(o.subject ?? o.Subject ?? ''),
    lastMessageAt:
      last instanceof Date ? last.toISOString() : String(last ?? new Date().toISOString()),
    lastFrom: (o.lastFrom ?? o.LastFrom) != null ? String(o.lastFrom ?? o.LastFrom) : undefined,
    messageCount: Number(o.messageCount ?? o.MessageCount ?? 0) || 0,
    status: String(o.status ?? o.Status ?? 'open'),
  };
}

export function normalizeEmailMessage(raw: unknown): {
  messageId: string;
  from: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  direction: string;
  createdAt: string;
} {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const created = o.createdAt ?? o.CreatedAt;
  const html = o.bodyHtml ?? o.BodyHtml;
  return {
    messageId: String(o.messageId ?? o.MessageId ?? ''),
    from: String(o.from ?? o.From ?? ''),
    subject: String(o.subject ?? o.Subject ?? ''),
    bodyText: String(o.bodyText ?? o.BodyText ?? ''),
    bodyHtml: html != null && String(html).trim() ? String(html) : undefined,
    direction: String(o.direction ?? o.Direction ?? 'outbound'),
    createdAt:
      created instanceof Date
        ? created.toISOString()
        : typeof created === 'string'
          ? created
          : new Date().toISOString(),
  };
}
