'use client';

import { useMemo } from 'react';

import type { Chapter } from '@/types/cms';

export function useChapterNavigation(chapters: Chapter[], currentChapterSlug: string) {
  return useMemo(() => {
    const currentIndex = chapters.findIndex((candidate) => candidate.slug === currentChapterSlug);

    return {
      previousChapter: currentIndex > 0 ? chapters[currentIndex - 1] : null,
      nextChapter:
        currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null,
    };
  }, [currentChapterSlug, chapters]);
}
