import { ProgressBar } from '@/components/ui/aria/progress';

interface ReadingProgressBarProps {
  progress: number;
}

export function ReadingProgressBar({ progress }: ReadingProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  if (clampedProgress <= 0) return null;

  return (
    <div className="mb-6">
      <div className="mb-1 text-sm font-medium tabular-nums text-gray-500">
        Reading progress: {clampedProgress}%
      </div>
      <ProgressBar aria-label="Reading progress" value={clampedProgress} />
    </div>
  );
}
