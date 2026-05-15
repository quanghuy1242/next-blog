import { TextLink } from '@/components/ui/aria/link';

interface DraftBannerProps {
  exitHref?: string;
}

export function DraftBanner({ exitHref = '/api/draft-exit' }: DraftBannerProps) {
  return (
    <div className="alert alert-warning fixed inset-x-0 top-0 z-50 justify-center rounded-none px-4 py-2 text-center text-sm">
      <p>
        <strong>Draft Mode</strong> — You are viewing an unpublished draft.{' '}
        <TextLink
          href={exitHref}
          className="text-warning-content underline hover:text-warning-content"
        >
          Exit draft mode
        </TextLink>
      </p>
    </div>
  );
}
