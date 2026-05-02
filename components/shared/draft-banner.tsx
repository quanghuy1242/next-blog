import Link from 'next/link';

interface DraftBannerProps {
  exitHref?: string;
}

export function DraftBanner({ exitHref = '/api/draft-exit' }: DraftBannerProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-yellow-400 bg-yellow-50 px-4 py-2 text-center text-sm text-yellow-800">
      <p>
        <strong>Draft Mode</strong> — You are viewing an unpublished draft.{' '}
        <Link
          href={exitHref}
          className="underline hover:text-yellow-900"
        >
          Exit draft mode
        </Link>
      </p>
    </div>
  );
}