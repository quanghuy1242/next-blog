import type { Post } from '@/types/cms';
import { uniqueSortedStrings } from '@/lib/shared/query';

const HOME_FEED_SNAPSHOT_PREFIX = 'home-feed:';
const HOME_FEED_SNAPSHOT_VERSION = 1;

export interface HomeFeedStateSnapshot {
  posts: Post[];
  offset: number;
  hasMore: boolean;
  category: string | null;
  tags: string[];
}

interface StoredHomeFeedSnapshot extends HomeFeedStateSnapshot {
  version: number;
}

export function buildHomeFeedSnapshotKey(
  category: string | null,
  tags: string[]
): string {
  const params = new URLSearchParams();

  if (category) {
    params.set('category', category);
  }

  for (const tag of uniqueSortedStrings(tags)) {
    params.append('tag', tag);
  }

  const query = params.toString();

  return `${HOME_FEED_SNAPSHOT_PREFIX}/${query ? `?${query}` : ''}`;
}

export function readHomeFeedSnapshot(
  category: string | null,
  tags: string[]
): HomeFeedStateSnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(
      buildHomeFeedSnapshotKey(category, tags)
    );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredHomeFeedSnapshot>;

    if (parsed.version !== HOME_FEED_SNAPSHOT_VERSION) {
      return null;
    }

    if (
      !Array.isArray(parsed.posts) ||
      typeof parsed.offset !== 'number' ||
      typeof parsed.hasMore !== 'boolean'
    ) {
      return null;
    }

    return {
      posts: parsed.posts,
      offset: parsed.offset,
      hasMore: parsed.hasMore,
      category: normalizeStoredCategory(parsed.category),
      tags: normalizeStoredTags(parsed.tags),
    };
  } catch {
    return null;
  }
}

export function writeHomeFeedSnapshot(snapshot: HomeFeedStateSnapshot) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      buildHomeFeedSnapshotKey(snapshot.category, snapshot.tags),
      JSON.stringify({
        version: HOME_FEED_SNAPSHOT_VERSION,
        ...snapshot,
        tags: uniqueSortedStrings(snapshot.tags),
      } satisfies StoredHomeFeedSnapshot)
    );
  } catch {
    // Best effort only.
  }
}

function normalizeStoredCategory(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length ? trimmed : null;
}

function normalizeStoredTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueSortedStrings(
    value.map((tag) => (typeof tag === 'string' ? tag : String(tag)))
  );
}
