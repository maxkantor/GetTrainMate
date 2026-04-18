import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminApiService } from '@/services/adminApiService';
import { pickPagedItems, pickPagedMeta, normalizeAdminUserRow } from '@/utils/adminApiNormalize';
import { PROFILE_SPORTS, normalizeSportTagsToCanonical, sortSportsByProfileOrder } from '@/constants/profileSports';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import styles from './UsersPage.module.css';

interface User {
  userId: string;
  email: string;
  name: string;
  status: string;
  plan?: string;
  createdAt: string;
  city?: string;
  state?: string;
  credits?: number;
  photoUrls?: string[];
}

type TestUserFormState = {
  userId: string;
  name: string;
  email: string;
  city: string;
  state: string;
  bio: string;
  level: string;
  mode: string;
  sportTags: string;
  goals: string;
  photoUrls: string;
};

const MAX_TEST_USER_PHOTOS = 6;

function parsePhotoUrlLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, MAX_TEST_USER_PHOTOS);
}

const EMPTY_FORM: TestUserFormState = {
  userId: '',
  name: '',
  email: '',
  city: 'San Francisco',
  state: 'CA',
  bio: '',
  level: 'intermediate',
  mode: 'TRAIN',
  sportTags: 'Running',
  goals: '',
  photoUrls: '',
};

/**
 * Lists seeded / test accounts (dummy-user-* and @test.com) from the API.
 * Production-safe: no passwords; credentials live only in your dev notes or Cognito.
 */
export const TestUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [form, setForm] = useState<TestUserFormState>(EMPTY_FORM);
  /** S3 objects may be private; map canonical public URL → presigned GET for admin preview. */
  const [photoPreviewMap, setPhotoPreviewMap] = useState<Record<string, string>>({});
  /** When set, next file picked goes to replace this index (0-based). */
  const [replaceSlotIndex, setReplaceSlotIndex] = useState<number | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '50',
        testUsersOnly: 'true',
      });
      const response = await adminApiService.get(`/api/admin/users?${params}`);
      const rows = pickPagedItems<Record<string, unknown>>(response).map((r) => normalizeAdminUserRow(r));
      setUsers(rows);
      setTotalPages(pickPagedMeta(response).totalPages);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load test users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const seedDummyUsers = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await adminApiService.post('/api/admin/users/seed-dummy');
      const created = Number(response?.created?.length ?? response?.Created?.length ?? 0);
      const failed = Number(response?.failed?.length ?? response?.Failed?.length ?? 0);
      setSuccess(`Seed complete: ${created} created, ${failed} failed.`);
      await loadUsers();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to seed dummy users');
    } finally {
      setLoading(false);
    }
  }, [loadUsers]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setActiveUserId(null);
    setIsEditing(false);
    setPhotoPreviewMap({});
  }, []);

  const startCreate = useCallback(() => {
    setError(null);
    setSuccess(null);
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const startEdit = useCallback(async (row: User) => {
    setError(null);
    setSuccess(null);
    setFormLoading(true);
    setShowForm(true);
    setIsEditing(true);
    setActiveUserId(row.userId);
    try {
      const detail = await adminApiService.get(`/api/admin/users/${encodeURIComponent(row.userId)}`);
      const o = (detail && typeof detail === 'object' ? detail : {}) as Record<string, unknown>;
      const photoUrls = Array.isArray(o.photoUrls ?? o.PhotoUrls)
        ? ((o.photoUrls ?? o.PhotoUrls) as unknown[]).map((x) => String(x))
        : [];
      const photoPreviewFromGet = Array.isArray(o.photoPreviewUrls ?? o.PhotoPreviewUrls)
        ? ((o.photoPreviewUrls ?? o.PhotoPreviewUrls) as unknown[]).map((x) => String(x))
        : [];
      const rawSports = Array.isArray(o.sportTags ?? o.SportTags)
        ? ((o.sportTags ?? o.SportTags) as unknown[]).map((x) => String(x))
        : [];
      const sportTags = sortSportsByProfileOrder(
        normalizeSportTagsToCanonical(rawSports.join(','))
      ).join(', ');
      const goals = Array.isArray(o.goals ?? o.Goals)
        ? ((o.goals ?? o.Goals) as unknown[]).map((x) => String(x)).join(', ')
        : '';

      setForm({
        userId: String(o.userId ?? o.UserId ?? row.userId),
        name: String(o.name ?? o.Name ?? row.name ?? ''),
        email: String(o.email ?? o.Email ?? row.email ?? ''),
        city: String(o.city ?? o.City ?? row.city ?? ''),
        state: String(o.state ?? o.State ?? row.state ?? ''),
        bio: String(o.bio ?? o.Bio ?? ''),
        level: String(o.level ?? o.Level ?? 'intermediate'),
        mode: String(o.mode ?? o.Mode ?? 'TRAIN'),
        sportTags,
        goals,
        photoUrls: photoUrls.join('\n'),
      });
      if (photoUrls.length > 0) {
        if (photoPreviewFromGet.length === photoUrls.length) {
          const m: Record<string, string> = {};
          photoUrls.forEach((c, i) => {
            const key = c.trim();
            if (!key) return;
            const p = (photoPreviewFromGet[i] || '').trim();
            m[key] = p.length > 0 ? p : key;
          });
          setPhotoPreviewMap(m);
        } else {
          try {
            const prevRes = await adminApiService.post(
              `/api/admin/users/test-users/${encodeURIComponent(row.userId)}/photos/preview-urls`,
              { urls: photoUrls, Urls: photoUrls }
            );
            const raw = (prevRes as { previews?: Record<string, string>; Previews?: Record<string, string> }) ?? {};
            const previews = raw.previews ?? raw.Previews;
            if (previews && typeof previews === 'object') {
              setPhotoPreviewMap(previews as Record<string, string>);
            }
          } catch (prevErr: unknown) {
            setPhotoPreviewMap({});
            setError(
              (prevErr as Error)?.message ||
                'Could not load signed photo previews (private bucket). Save is unaffected; try refresh or re-open the user.'
            );
          }
        }
      } else {
        setPhotoPreviewMap({});
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load test user details');
      setShowForm(false);
      resetForm();
    } finally {
      setFormLoading(false);
    }
  }, [resetForm]);

  const updateForm = useCallback((key: keyof TestUserFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const sportTagsSelected = useMemo(
    () => normalizeSportTagsToCanonical(form.sportTags),
    [form.sportTags]
  );

  const toggleSportTag = useCallback((sport: string) => {
    const cur = normalizeSportTagsToCanonical(form.sportTags);
    const next = cur.includes(sport) ? cur.filter((s) => s !== sport) : [...cur, sport];
    updateForm('sportTags', sortSportsByProfileOrder(next).join(', '));
  }, [form.sportTags, updateForm]);

  const photoLines = useMemo(() => parsePhotoUrlLines(form.photoUrls), [form.photoUrls]);

  const saveForm = useCallback(async () => {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    setError(null);
    setSuccess(null);
    setFormLoading(true);
    try {
      const payload = {
        userId: form.userId.trim() || undefined,
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        bio: form.bio.trim() || undefined,
        level: form.level.trim() || undefined,
        mode: form.mode.trim() || undefined,
        sportTags: normalizeSportTagsToCanonical(form.sportTags),
        goals: form.goals
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        photoUrls: parsePhotoUrlLines(form.photoUrls),
      };

      if (isEditing && activeUserId) {
        await adminApiService.put(`/api/admin/users/test-users/${encodeURIComponent(activeUserId)}`, payload);
        setSuccess(`Updated ${form.name}.`);
      } else {
        await adminApiService.post('/api/admin/users/test-users', payload);
        setSuccess(`Created ${form.name}.`);
      }
      setShowForm(false);
      resetForm();
      await loadUsers();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to save test user');
    } finally {
      setFormLoading(false);
    }
  }, [activeUserId, form, isEditing, loadUsers, resetForm]);

  const uploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const targetUserId = (isEditing ? activeUserId ?? '' : form.userId).trim();
      if (!targetUserId) {
        setError('Set a test user ID before uploading images.');
        return;
      }
      if (!targetUserId.toLowerCase().startsWith('dummy-user-')) {
        setError('Test user ID must start with dummy-user- for uploads.');
        return;
      }

      const room = MAX_TEST_USER_PHOTOS - parsePhotoUrlLines(form.photoUrls).length;
      if (room <= 0) {
        setError(`You can have at most ${MAX_TEST_USER_PHOTOS} photos. Remove one to add more.`);
        return;
      }

      setUploadingPhotos(true);
      setError(null);
      try {
        const uploadedUrls: string[] = [];
        for (const file of Array.from(files).slice(0, room)) {
          const signed = await adminApiService.post(
            `/api/admin/users/test-users/${encodeURIComponent(targetUserId)}/photos/upload-url`,
            {
              contentType: file.type || 'application/octet-stream',
              fileName: file.name,
            }
          );

          const uploadUrl = String(signed?.uploadUrl ?? signed?.UploadUrl ?? '');
          const publicUrl = String(signed?.publicUrl ?? signed?.PublicUrl ?? '');
          const previewUrl = String(signed?.previewUrl ?? signed?.PreviewUrl ?? '');
          if (!uploadUrl || !publicUrl) {
            throw new Error('Upload URL response was incomplete.');
          }

          const putResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
            body: file,
          });

          if (!putResponse.ok) {
            throw new Error(`Failed uploading ${file.name} (${putResponse.status}).`);
          }
          uploadedUrls.push(publicUrl);
          if (previewUrl) {
            setPhotoPreviewMap((m) => ({ ...m, [publicUrl]: previewUrl }));
          }
        }

        if (uploadedUrls.length) {
          setForm((prev) => {
            const existing = parsePhotoUrlLines(prev.photoUrls);
            const merged = [...existing, ...uploadedUrls].slice(0, MAX_TEST_USER_PHOTOS);
            return { ...prev, photoUrls: merged.join('\n') };
          });
          setSuccess(`Uploaded ${uploadedUrls.length} image${uploadedUrls.length > 1 ? 's' : ''}.`);
        }
      } catch (err: unknown) {
        setError((err as Error)?.message || 'Image upload failed.');
      } finally {
        setUploadingPhotos(false);
      }
    },
    [activeUserId, form.photoUrls, form.userId, isEditing]
  );

  const removePhotoAt = useCallback(
    (index: number) => {
      const lines = parsePhotoUrlLines(form.photoUrls);
      const removed = lines[index];
      const next = lines.filter((_, i) => i !== index);
      updateForm('photoUrls', next.join('\n'));
      if (removed) {
        setPhotoPreviewMap((m) => {
          const c = { ...m };
          delete c[removed];
          return c;
        });
      }
    },
    [form.photoUrls, updateForm]
  );

  const makeCoverAt = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const lines = parsePhotoUrlLines(form.photoUrls);
      const url = lines[index];
      if (!url) return;
      const next = [url, ...lines.filter((_, i) => i !== index)];
      updateForm('photoUrls', next.join('\n'));
    },
    [form.photoUrls, updateForm]
  );

  const uploadToSlot = useCallback(
    async (file: File, slotIndex: number) => {
      const targetUserId = (isEditing ? activeUserId ?? '' : form.userId).trim();
      if (!targetUserId) {
        setError('Set a test user ID before uploading images.');
        return;
      }
      if (!targetUserId.toLowerCase().startsWith('dummy-user-')) {
        setError('Test user ID must start with dummy-user- for uploads.');
        return;
      }

      setUploadingPhotos(true);
      setError(null);
      try {
        const signed = await adminApiService.post(
          `/api/admin/users/test-users/${encodeURIComponent(targetUserId)}/photos/upload-url`,
          {
            contentType: file.type || 'application/octet-stream',
            fileName: file.name,
          }
        );

        const uploadUrl = String(signed?.uploadUrl ?? signed?.UploadUrl ?? '');
        const publicUrl = String(signed?.publicUrl ?? signed?.PublicUrl ?? '');
        const previewUrl = String(signed?.previewUrl ?? signed?.PreviewUrl ?? '');
        if (!uploadUrl || !publicUrl) {
          throw new Error('Upload URL response was incomplete.');
        }

        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (!putResponse.ok) {
          throw new Error(`Failed uploading (${putResponse.status}).`);
        }

        let oldUrlReplaced: string | undefined;
        setForm((prev) => {
          const lines = parsePhotoUrlLines(prev.photoUrls);
          if (slotIndex < 0 || slotIndex >= lines.length) return prev;
          oldUrlReplaced = lines[slotIndex];
          const next = [...lines];
          next[slotIndex] = publicUrl;
          return { ...prev, photoUrls: next.join('\n') };
        });
        setPhotoPreviewMap((m) => {
          const c = { ...m };
          if (oldUrlReplaced) delete c[oldUrlReplaced];
          if (previewUrl) c[publicUrl] = previewUrl;
          return c;
        });
        setSuccess('Photo updated.');
      } catch (err: unknown) {
        setError((err as Error)?.message || 'Image upload failed.');
      } finally {
        setUploadingPhotos(false);
      }
    },
    [activeUserId, form.userId, isEditing]
  );

  const openReplacePicker = useCallback((index: number) => {
    setReplaceSlotIndex(index);
    requestAnimationFrame(() => replaceFileInputRef.current?.click());
  }, []);

  const handleReplaceFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      const slot = replaceSlotIndex;
      setReplaceSlotIndex(null);
      if (!file || slot === null) return;
      await uploadToSlot(file, slot);
    },
    [replaceSlotIndex, uploadToSlot]
  );

  const deleteActiveUser = useCallback(async () => {
    if (!activeUserId || !isEditing) return;
    if (
      !window.confirm(
        `Permanently delete this user (${form.name || activeUserId})? Their profile will be removed from the database; Cognito user is removed when present. This cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingUser(true);
    setError(null);
    setSuccess(null);
    try {
      await adminApiService.delete(`/api/admin/users/${encodeURIComponent(activeUserId)}`);
      setSuccess('User deleted.');
      setShowForm(false);
      resetForm();
      await loadUsers();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to delete user');
    } finally {
      setDeletingUser(false);
    }
  }, [activeUserId, isEditing, form.name, loadUsers, resetForm]);

  const columns: Column<User>[] = [
    {
      key: 'userId',
      header: 'User ID',
      render: (r) => (
        <span className={styles.mono}>
          {(r.userId || '').length > 18 ? `${(r.userId || '').slice(0, 18)}…` : r.userId || '—'}
        </span>
      ),
    },
    { key: 'email', header: 'Email' },
    { key: 'name', header: 'Name' },
    {
      key: 'location',
      header: 'City / State',
      render: (r) => [r.city, r.state].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge variant={r.status === 'active' ? 'success' : r.status === 'banned' ? 'error' : 'neutral'}>
          {r.status}
        </Badge>
      ),
    },
    { key: 'plan', header: 'Plan', render: (r) => r.plan || '—' },
    { key: 'credits', header: 'Credits', render: (r) => String(r.credits ?? 0) },
    { key: 'createdAt', header: 'Created', render: (r) => new Date(r.createdAt).toLocaleDateString() },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <Button variant="secondary" size="sm" onClick={() => void startEdit(r)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Test Users</h1>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => void seedDummyUsers()} loading={loading}>
            Seed dummy set
          </Button>
          <Button size="sm" onClick={startCreate}>
            Add test user
          </Button>
        </div>
      </div>
      <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-neutral-500)', fontSize: 'var(--font-sm)' }}>
        Dummy and seeded accounts excluded from Users CRM. Add more via seed-dummy (dev) or signup in staging.
      </p>

      {error && (
        <div className={styles.alert} role="alert">
          {error}
          <button type="button" className={styles.dismiss} onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      {success && (
        <div className={styles.alertSuccess} role="status">
          {success}
          <button type="button" className={styles.dismiss} onClick={() => setSuccess(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={users}
        keyField="userId"
        emptyMessage="No test users found."
        loading={loading}
        onRowClick={(row) => void startEdit(row)}
      />

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {showForm && <div className={styles.backdrop} onClick={() => setShowForm(false)} />}
      {showForm && (
        <div className={`${styles.detailPanel} ${styles.open}`}>
          <div className={styles.detailHeader}>
            <h2>{isEditing ? 'Edit test user' : 'Add test user'}</h2>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              aria-label="Close panel"
            >
              ×
            </button>
          </div>
          <div className={styles.detailContent}>
            {formLoading ? (
              <div className={styles.detailLoading}>Loading…</div>
            ) : (
              <>
                {!isEditing && (
                  <label className={styles.formField}>
                    <span>User ID (optional)</span>
                    <input
                      className={styles.search}
                      value={form.userId}
                      onChange={(e) => updateForm('userId', e.target.value)}
                      placeholder="dummy-user-custom-id"
                    />
                  </label>
                )}
                <label className={styles.formField}>
                  <span>Name</span>
                  <input className={styles.search} value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
                </label>
                <label className={styles.formField}>
                  <span>Email (@test.com)</span>
                  <input className={styles.search} value={form.email} onChange={(e) => updateForm('email', e.target.value)} />
                </label>
                <div className={styles.formGrid}>
                  <label className={styles.formField}>
                    <span>City</span>
                    <input className={styles.search} value={form.city} onChange={(e) => updateForm('city', e.target.value)} />
                  </label>
                  <label className={styles.formField}>
                    <span>State</span>
                    <input className={styles.search} value={form.state} onChange={(e) => updateForm('state', e.target.value)} />
                  </label>
                </div>
                <div className={styles.formGrid}>
                  <label className={styles.formField}>
                    <span>Level</span>
                    <select className={styles.select} value={form.level} onChange={(e) => updateForm('level', e.target.value)}>
                      <option value="beginner">beginner</option>
                      <option value="intermediate">intermediate</option>
                      <option value="advanced">advanced</option>
                      <option value="pro">pro</option>
                    </select>
                  </label>
                  <label className={styles.formField}>
                    <span>Mode</span>
                    <select className={styles.select} value={form.mode} onChange={(e) => updateForm('mode', e.target.value)}>
                      <option value="TRAIN">TRAIN</option>
                      <option value="VIBE">VIBE</option>
                      <option value="DATE">DATE</option>
                    </select>
                  </label>
                </div>
                <div className={styles.formField}>
                  <span>Sports (same list as app Profile)</span>
                  <div className={styles.sportCheckboxPanel} role="group" aria-label="Sports">
                    {PROFILE_SPORTS.map((s) => (
                      <label key={s} className={styles.sportCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={sportTagsSelected.includes(s)}
                          onChange={() => toggleSportTag(s)}
                        />
                        <span>{s}</span>
                      </label>
                    ))}
                  </div>
                  <span className={styles.fieldHint}>Check all that apply. Values match the in-app sport picker.</span>
                </div>
                <label className={styles.formField}>
                  <span>Goals (comma-separated)</span>
                  <input
                    className={styles.search}
                    value={form.goals}
                    onChange={(e) => updateForm('goals', e.target.value)}
                    placeholder="Complete a marathon, Improve pace"
                  />
                </label>
                <label className={styles.formField}>
                  <span>Bio</span>
                  <textarea
                    className={styles.formTextarea}
                    value={form.bio}
                    onChange={(e) => updateForm('bio', e.target.value)}
                    rows={4}
                  />
                </label>
                <div className={styles.formField}>
                  <span>Profile photos</span>
                  <p className={styles.fieldHint}>
                    First image is the Discover cover. Use thumbnails to remove, replace, or set cover — or edit URLs
                    below. Max {MAX_TEST_USER_PHOTOS} images.
                  </p>
                  <div className={styles.uploadRow}>
                    <input
                      id="test-user-photo-upload"
                      className={styles.hiddenInput}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => void uploadFiles(e.target.files)}
                      disabled={uploadingPhotos}
                    />
                    <input
                      ref={replaceFileInputRef}
                      className={styles.hiddenInput}
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleReplaceFileChange(e)}
                      disabled={uploadingPhotos}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById('test-user-photo-upload') as HTMLInputElement | null;
                        input?.click();
                      }}
                      loading={uploadingPhotos}
                    >
                      Add images
                    </Button>
                    <span className={styles.uploadHint}>
                      Canonical S3 URLs; preview uses a signed URL when the bucket is private.
                    </span>
                  </div>

                  {photoLines.length > 0 ? (
                    <div className={styles.photoPreviewGrid}>
                      {photoLines.map((url, index) => (
                        <div key={`${url}-${index}`} className={styles.photoPreviewTile}>
                          <div className={styles.photoPreviewFrame}>
                            <img
                              className={styles.photoPreview}
                              src={photoPreviewMap[url] ?? url}
                              alt=""
                            />
                            <button
                              type="button"
                              className={styles.photoPreviewRemove}
                              onClick={() => removePhotoAt(index)}
                              aria-label="Remove this photo"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                          <div className={styles.photoPreviewToolbar}>
                            {index === 0 ? (
                              <span className={styles.photoCoverBadge}>Cover</span>
                            ) : (
                              <button
                                type="button"
                                className={styles.photoPreviewLinkBtn}
                                onClick={() => makeCoverAt(index)}
                                disabled={uploadingPhotos}
                              >
                                Make cover
                              </button>
                            )}
                            <button
                              type="button"
                              className={styles.photoPreviewLinkBtn}
                              onClick={() => openReplacePicker(index)}
                              disabled={uploadingPhotos}
                            >
                              Replace
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.formField} style={{ marginTop: 'var(--space-3)' }}>
                    <span>Photo URLs (one per line)</span>
                    <textarea
                      className={styles.formTextarea}
                      value={form.photoUrls}
                      onChange={(e) => updateForm('photoUrls', e.target.value)}
                      placeholder="https://example.com/photo1.jpg"
                      rows={4}
                    />
                  </div>
                </div>

                <div className={styles.detailActions}>
                  {isEditing && activeUserId ? (
                    <Button variant="danger" onClick={() => void deleteActiveUser()} loading={deletingUser}>
                      Delete user
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void saveForm()} loading={formLoading}>
                    {isEditing ? 'Save changes' : 'Create test user'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
