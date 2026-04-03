import { authService } from '@/services/authService';
import { matchService, type SentRequestItem, type SkippedProfileItem } from '@/services/matchService';
import { profileService } from '@/services/profileService';
import { chatService } from '@/services/chatService';
import {
  isGraphQLEnabled,
  graphqlListMyMatches,
  graphqlListMySentRequests,
  graphqlListMySkipped,
} from '@/services/graphqlService';
import { RELATIONSHIP_LIST_LIMIT } from '@/config/relationshipLimits';

/** Row shape shared by Matches page and match-status header (TanStack Query cache). */
export interface MutualMatchRow {
  matchId: string;
  userId: string;
  name: string;
  photoUrls?: string[];
  bio?: string;
  city?: string;
  level?: string;
  sportTags: string[];
  modes?: string[];
  matchedAt: string;
  compatibilityScore?: number;
  unlockedByMe?: boolean;
}

function filterSelfFromMutualRows(rows: MutualMatchRow[], selfId: string): MutualMatchRow[] {
  return rows.filter((r) => r.userId && r.userId !== selfId);
}

export async function fetchMutualMatchRows(currentUserSub: string): Promise<MutualMatchRow[]> {
  if (!currentUserSub) return [];

  if (isGraphQLEnabled) {
    const items = await graphqlListMyMatches();
    const mapped: MutualMatchRow[] = (
      items as {
        matchId: string;
        threadId: string;
        unlockedByMe: boolean;
        createdAt?: string;
        otherUserProfile?: {
          userId: string;
          displayName: string;
          city?: string;
          bio?: string;
          sports?: string[];
          avatarUrl?: string;
          modes?: string[];
          mode?: string;
          level?: string;
        };
      }[]
    ).map((m) => {
      const op = m.otherUserProfile;
      const modes =
        op?.modes && op.modes.length > 0
          ? op.modes.map(String)
          : op?.mode
            ? [String(op.mode)]
            : [];
      return {
        matchId: m.matchId,
        userId: op?.userId ?? '',
        name: op?.displayName ?? 'Unknown User',
        photoUrls: op?.avatarUrl ? [op.avatarUrl] : [],
        bio: op?.bio ?? '',
        city: op?.city ?? '',
        level: op?.level ?? '',
        sportTags: op?.sports ?? [],
        modes,
        matchedAt: m.createdAt ?? new Date().toISOString(),
        compatibilityScore: undefined,
        unlockedByMe: m.unlockedByMe,
      };
    });
    return filterSelfFromMutualRows(mapped, currentUserSub);
  }

  const token = await authService.getJWT();
  if (!token) return [];

  const matchesData = await matchService.getMyMatches(token);
  const transformed: MutualMatchRow[] = await Promise.all(
    matchesData.map(
      async (match: {
        matchId: string;
        userId1: string;
        userId2: string;
        createdAt?: string;
        compatibilityScore?: number;
      }) => {
        const otherUserId = match.userId1 === currentUserSub ? match.userId2 : match.userId1;
        let unlockedByMe = false;
        try {
          const threadStatus = await chatService.getThreadByMatch(token, match.matchId);
          unlockedByMe = threadStatus.unlockedByCurrentUser;
        } catch {
          /* thread may not exist yet */
        }
        try {
          const profile = await profileService.getProfile(token, otherUserId);
          const modes =
            profile.modes && profile.modes.length > 0
              ? profile.modes.map(String)
              : profile.mode
                ? [String(profile.mode)]
                : [];
          return {
            matchId: match.matchId,
            userId: otherUserId,
            name: profile.name || 'Unknown User',
            photoUrls: profile.photoUrls || [],
            bio: profile.bio || '',
            city: profile.city || '',
            level: profile.level || '',
            sportTags: profile.sportTags || [],
            modes,
            matchedAt: match.createdAt || new Date().toISOString(),
            compatibilityScore: match.compatibilityScore || 0,
            unlockedByMe,
          };
        } catch {
          return {
            matchId: match.matchId,
            userId: otherUserId,
            name: 'Unknown User',
            photoUrls: [],
            bio: '',
            city: '',
            level: '',
            sportTags: [],
            modes: [],
            matchedAt: match.createdAt || new Date().toISOString(),
            compatibilityScore: match.compatibilityScore || 0,
            unlockedByMe,
          };
        }
      }
    )
  );

  return filterSelfFromMutualRows(transformed, currentUserSub);
}

export async function fetchSentRequestsForUser(_userSub: string): Promise<SentRequestItem[]> {
  let list: SentRequestItem[];
  if (isGraphQLEnabled) {
    list = await graphqlListMySentRequests();
  } else {
    const token = await authService.getJWT(true);
    if (!token) throw new Error('Not authenticated');
    list = await matchService.getSentRequests(token);
  }
  return list.slice(0, RELATIONSHIP_LIST_LIMIT);
}

export async function fetchSkippedProfilesForUser(_userSub: string): Promise<SkippedProfileItem[]> {
  let list: SkippedProfileItem[];
  if (isGraphQLEnabled) {
    list = await graphqlListMySkipped();
  } else {
    const token = await authService.getJWT(true);
    if (!token) throw new Error('Not authenticated');
    list = await matchService.getSkippedProfiles(token);
  }
  return list.slice(0, RELATIONSHIP_LIST_LIMIT);
}
