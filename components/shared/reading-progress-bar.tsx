interface ReadingProgressBarProps {
  progress: number;
}

export function ReadingProgressBar({ progress }: ReadingProgressBarProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  if (clampedProgress <= 0) return null;

  return (
    <div className="h-1 w-full bg-gray-200" role="progressbar" aria-valuenow={clampedProgress} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full bg-blue-500 transition-[width] duration-300"
        style={{ width: `${clampedProgress}%` }}
      />
    </div>
  );
}