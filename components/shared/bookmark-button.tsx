import { useBookmark } from 'hooks/useBookmark';

interface BookmarkButtonProps {
  contentType: 'chapter' | 'book';
  contentId: number;
  isAuthenticated: boolean;
}

export function BookmarkButton({ contentType, contentId, isAuthenticated }: BookmarkButtonProps) {
  if (!isAuthenticated) {
    return null;
  }

  return <BookmarkButtonInner contentType={contentType} contentId={contentId} />;
}

function BookmarkButtonInner({
  contentType,
  contentId,
}: {
  contentType: 'chapter' | 'book';
  contentId: number;
}) {
  const { isBookmarked, isLoading, isMutating, toggle } = useBookmark({
    contentType,
    contentId,
    enabled: true,
  });

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isLoading || isMutating}
      className="inline-flex items-center gap-1.5 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400 disabled:opacity-50"
      aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      aria-pressed={isBookmarked}
    >
      <svg
        viewBox="0 0 24 24"
        fill={isBookmarked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
      <span>{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
    </button>
  );
}
