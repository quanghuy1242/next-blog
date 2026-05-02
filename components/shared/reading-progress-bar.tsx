interface ReadingProgressBarProps {
  progress: number;
}

export function ReadingProgressBar({ progress }: ReadingProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  if (clampedProgress <= 0) return null;

  return (
    <p className="mb-6 text-sm font-medium tabular-nums text-gray-500">
      Reading progress: {clampedProgress}%
    </p>
  );
}
