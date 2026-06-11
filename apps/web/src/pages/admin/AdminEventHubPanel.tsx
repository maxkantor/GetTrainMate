import React, { useCallback, useEffect, useState } from 'react';
import { adminApiService } from '@/services/adminApiService';
import styles from './AdminPlaceholderPage.module.css';
import type {
  EventGroup, EventTeam, EventMatch, EventHubAnalytics, EventComment,
} from '@/services/sportsEventLayerService';

type HubTab = 'settings' | 'groups' | 'teams' | 'matches' | 'moderation' | 'analytics';

type EventConfigExt = {
  eventId: string;
  label: string;
  sport: string;
  enabled: boolean;
  isFeatured: boolean;
  startDate: string;
  endDate: string;
  homepageHeadline?: string;
  homepageSubheadline?: string;
  homepageCtaPrimary?: string;
  homepageCtaSecondary?: string;
  homepagePromoText?: string;
  homepageBackgroundImage?: string;
  homepageVisible?: boolean;
  navbarVisible?: boolean;
  hubRoute?: string;
  predictionsEnabled?: boolean;
  exactScoreEnabled?: boolean;
  winnerPickEnabled?: boolean;
  drawPickEnabled?: boolean;
  commentsEnabled?: boolean;
  sharingEnabled?: boolean;
  themeColor?: string;
  description?: string;
  icon?: string;
  activities?: string[];
  tags?: string[];
};

type Props = {
  eventId: string;
  config: EventConfigExt;
  onConfigSaved: () => void;
};

export const AdminEventHubPanel: React.FC<Props> = ({ eventId, config, onConfigSaved }) => {
  const [tab, setTab] = useState<HubTab>('settings');
  const [settings, setSettings] = useState<EventConfigExt>(config);
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [teams, setTeams] = useState<EventTeam[]>([]);
  const [matches, setMatches] = useState<EventMatch[]>([]);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [analytics, setAnalytics] = useState<EventHubAnalytics | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newTeam, setNewTeam] = useState({ name: '', country: '', flagEmoji: '', groupId: '' });
  const [newMatch, setNewMatch] = useState({
    teamAId: '', teamBId: '', matchDate: '', matchTime: '', venue: '', status: 'Scheduled' as const,
  });

  const loadHub = useCallback(async () => {
    try {
      const hub = await adminApiService.get(`/api/admin/sports-events/${eventId}/hub`);
      setGroups(hub?.groups ?? []);
      setTeams(hub?.teams ?? []);
      setMatches(hub?.matches ?? []);
    } catch {
      /* hub may be empty */
    }
  }, [eventId]);

  const loadComments = useCallback(async () => {
    try {
      const res = await adminApiService.get(`/api/admin/sports-events/${eventId}/comments`);
      setComments(res ?? []);
    } catch { /* */ }
  }, [eventId]);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await adminApiService.get(`/api/admin/sports-events/${eventId}/analytics`);
      setAnalytics(res);
    } catch { /* */ }
  }, [eventId]);

  useEffect(() => { setSettings(config); }, [config]);
  useEffect(() => { void loadHub(); }, [loadHub]);
  useEffect(() => {
    if (tab === 'moderation') void loadComments();
    if (tab === 'analytics') void loadAnalytics();
  }, [tab, loadComments, loadAnalytics]);

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApiService.put(`/api/admin/sports-events/${eventId}`, settings);
      onConfigSaved();
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveGroup = async () => {
    if (!newGroupLabel.trim()) return;
    const groupId = `group-${newGroupLabel.toLowerCase().replace(/\s+/g, '-')}`;
    await adminApiService.put(`/api/admin/sports-events/${eventId}/groups`, {
      eventId, groupId, label: newGroupLabel, sortOrder: groups.length,
    });
    setNewGroupLabel('');
    await loadHub();
  };

  const saveTeam = async () => {
    if (!newTeam.name.trim()) return;
    const teamId = newTeam.country.toLowerCase().replace(/\s+/g, '-');
    await adminApiService.put(`/api/admin/sports-events/${eventId}/teams`, {
      eventId, teamId, ...newTeam, sortOrder: teams.length,
      played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    });
    setNewTeam({ name: '', country: '', flagEmoji: '', groupId: '' });
    await loadHub();
  };

  const saveMatch = async () => {
    if (!newMatch.teamAId || !newMatch.teamBId) return;
    const matchId = `match-${Date.now()}`;
    const teamA = teams.find((t) => t.teamId === newMatch.teamAId);
    const teamB = teams.find((t) => t.teamId === newMatch.teamBId);
    await adminApiService.put(`/api/admin/sports-events/${eventId}/matches`, {
      eventId, matchId, ...newMatch,
      teamAName: teamA?.name, teamBName: teamB?.name,
      teamAFlag: teamA?.flagEmoji, teamBFlag: teamB?.flagEmoji,
    });
    setNewMatch({ teamAId: '', teamBId: '', matchDate: '', matchTime: '', venue: '', status: 'Scheduled' });
    await loadHub();
  };

  const updateMatchScore = async (match: EventMatch) => {
    await adminApiService.put(`/api/admin/sports-events/${eventId}/matches`, match);
    await loadHub();
  };

  const hideComment = async (commentKey: string) => {
    await adminApiService.post(`/api/admin/sports-events/${eventId}/comments/${encodeURIComponent(commentKey)}/hide`, {});
    await loadComments();
  };

  const deleteComment = async (commentKey: string) => {
    await adminApiService.delete(`/api/admin/sports-events/${eventId}/comments/${encodeURIComponent(commentKey)}`);
    await loadComments();
  };

  const TABS: { id: HubTab; label: string }[] = [
    { id: 'settings', label: 'Global & Homepage' },
    { id: 'groups', label: 'Groups' },
    { id: 'teams', label: 'Teams' },
    { id: 'matches', label: 'Matches' },
    { id: 'moderation', label: 'Moderation' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className={styles.wrap} style={{ marginTop: '1.5rem' }}>
      <h3>Event Hub — {config.label}</h3>
      {error && <p className={styles.error}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? styles.primaryBtn : styles.secondaryBtn}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <div className={styles.formGrid}>
          <label>Enabled <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} /></label>
          <label>Navbar Visible <input type="checkbox" checked={settings.navbarVisible !== false} onChange={(e) => setSettings({ ...settings, navbarVisible: e.target.checked })} /></label>
          <label>Homepage Visible <input type="checkbox" checked={settings.homepageVisible !== false} onChange={(e) => setSettings({ ...settings, homepageVisible: e.target.checked })} /></label>
          <label>Start Date <input type="datetime-local" value={settings.startDate?.slice(0, 16)} onChange={(e) => setSettings({ ...settings, startDate: new Date(e.target.value).toISOString() })} /></label>
          <label>End Date <input type="datetime-local" value={settings.endDate?.slice(0, 16)} onChange={(e) => setSettings({ ...settings, endDate: new Date(e.target.value).toISOString() })} /></label>
          <label>Hub Route <input value={settings.hubRoute ?? '/world-cup'} onChange={(e) => setSettings({ ...settings, hubRoute: e.target.value })} /></label>
          <label>Homepage Headline <input value={settings.homepageHeadline ?? ''} onChange={(e) => setSettings({ ...settings, homepageHeadline: e.target.value })} /></label>
          <label>Homepage Subheadline <input value={settings.homepageSubheadline ?? ''} onChange={(e) => setSettings({ ...settings, homepageSubheadline: e.target.value })} /></label>
          <label>CTA Primary <input value={settings.homepageCtaPrimary ?? ''} onChange={(e) => setSettings({ ...settings, homepageCtaPrimary: e.target.value })} /></label>
          <label>CTA Secondary <input value={settings.homepageCtaSecondary ?? ''} onChange={(e) => setSettings({ ...settings, homepageCtaSecondary: e.target.value })} /></label>
          <label>Promo Text <input value={settings.homepagePromoText ?? ''} onChange={(e) => setSettings({ ...settings, homepagePromoText: e.target.value })} /></label>
          <label>Predictions <input type="checkbox" checked={settings.predictionsEnabled !== false} onChange={(e) => setSettings({ ...settings, predictionsEnabled: e.target.checked })} /></label>
          <label>Exact Scores <input type="checkbox" checked={settings.exactScoreEnabled !== false} onChange={(e) => setSettings({ ...settings, exactScoreEnabled: e.target.checked })} /></label>
          <label>Comments <input type="checkbox" checked={settings.commentsEnabled !== false} onChange={(e) => setSettings({ ...settings, commentsEnabled: e.target.checked })} /></label>
          <label>Sharing <input type="checkbox" checked={settings.sharingEnabled !== false} onChange={(e) => setSettings({ ...settings, sharingEnabled: e.target.checked })} /></label>
          <button type="button" className={styles.primaryBtn} disabled={saving} onClick={saveSettings}>Save Settings</button>
        </div>
      )}

      {tab === 'groups' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input placeholder="Group label (e.g. Group A)" value={newGroupLabel} onChange={(e) => setNewGroupLabel(e.target.value)} />
            <button type="button" className={styles.primaryBtn} onClick={saveGroup}>Add Group</button>
          </div>
          {groups.map((g) => <div key={g.groupId} className={styles.row}>{g.label} ({g.groupId})</div>)}
        </div>
      )}

      {tab === 'teams' && (
        <div>
          <div className={styles.formGrid}>
            <input placeholder="Name" value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} />
            <input placeholder="Country" value={newTeam.country} onChange={(e) => setNewTeam({ ...newTeam, country: e.target.value })} />
            <input placeholder="Flag emoji" value={newTeam.flagEmoji} onChange={(e) => setNewTeam({ ...newTeam, flagEmoji: e.target.value })} />
            <select value={newTeam.groupId} onChange={(e) => setNewTeam({ ...newTeam, groupId: e.target.value })}>
              <option value="">Select group</option>
              {groups.map((g) => <option key={g.groupId} value={g.groupId}>{g.label}</option>)}
            </select>
            <button type="button" className={styles.primaryBtn} onClick={saveTeam}>Add Team</button>
          </div>
          {teams.map((t) => (
            <div key={t.teamId} className={styles.row}>
              {t.flagEmoji} {t.name} — {t.groupId} — P:{t.points} W:{t.wins} D:{t.draws} L:{t.losses}
              <button type="button" className={styles.secondaryBtn} onClick={async () => {
                await adminApiService.put(`/api/admin/sports-events/${eventId}/teams`, { ...t, points: t.wins * 3 + t.draws, goalDifference: t.goalsFor - t.goalsAgainst });
                await loadHub();
              }}>Recalc</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'matches' && (
        <div>
          <div className={styles.formGrid}>
            <select value={newMatch.teamAId} onChange={(e) => setNewMatch({ ...newMatch, teamAId: e.target.value })}>
              <option value="">Team A</option>
              {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
            </select>
            <select value={newMatch.teamBId} onChange={(e) => setNewMatch({ ...newMatch, teamBId: e.target.value })}>
              <option value="">Team B</option>
              {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
            </select>
            <input type="date" value={newMatch.matchDate} onChange={(e) => setNewMatch({ ...newMatch, matchDate: e.target.value })} />
            <input type="time" value={newMatch.matchTime} onChange={(e) => setNewMatch({ ...newMatch, matchTime: e.target.value })} />
            <input placeholder="Venue" value={newMatch.venue} onChange={(e) => setNewMatch({ ...newMatch, venue: e.target.value })} />
            <button type="button" className={styles.primaryBtn} onClick={saveMatch}>Add Match</button>
          </div>
          {matches.map((m) => (
            <div key={m.matchId} className={styles.row} style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>{m.teamAName} vs {m.teamBName} — {m.matchDate}</span>
              <select value={m.status} onChange={(e) => updateMatchScore({ ...m, status: e.target.value as EventMatch['status'] })}>
                <option value="Scheduled">Scheduled</option>
                <option value="Live">Live</option>
                <option value="Completed">Completed</option>
              </select>
              <input type="number" placeholder="Score A" style={{ width: 60 }} value={m.scoreA ?? ''} onChange={(e) => updateMatchScore({ ...m, scoreA: parseInt(e.target.value, 10) || 0 })} />
              <input type="number" placeholder="Score B" style={{ width: 60 }} value={m.scoreB ?? ''} onChange={(e) => updateMatchScore({ ...m, scoreB: parseInt(e.target.value, 10) || 0 })} />
            </div>
          ))}
        </div>
      )}

      {tab === 'moderation' && (
        <div>
          {comments.map((c) => (
            <div key={c.commentKey} className={styles.row}>
              <span>{c.userDisplayName ?? c.userId}: {c.body}</span>
              <button type="button" className={styles.secondaryBtn} onClick={() => hideComment(c.commentKey)}>Hide</button>
              <button type="button" className={styles.secondaryBtn} onClick={() => deleteComment(c.commentKey)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'analytics' && analytics && (
        <div className={styles.formGrid}>
          <div>Total Predictions: {analytics.totalPredictions}</div>
          <div>Total Comments: {analytics.totalComments}</div>
          <div>Total Shares: {analytics.totalShares}</div>
          <div>Unique Predictors: {analytics.uniquePredictors}</div>
          <h4>Top Predictors</h4>
          {analytics.topPredictors?.map((e, i) => (
            <div key={e.userId}>{i + 1}. {e.displayName ?? e.userId} — {e.score} pts</div>
          ))}
        </div>
      )}
    </div>
  );
};
