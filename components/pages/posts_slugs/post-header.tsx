import cn from 'classnames';
import { ResponsiveImage } from 'components/shared/responsive-image';
import { Date } from 'components/shared/date';
import { Tag } from 'components/shared/tags';

interface PostHeaderProps {
  header: string;
  date: string;
  category: string;
  imageUrl: string;
  className?: string;
}

export function PostHeader({
  header,
  date,
  category,
  imageUrl,
  className,
}: PostHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col justify-center items-center',
        'h-banner',
        'text-white text-center',
        'relative overflow-hidden',
        className
      )}
    >
      {/* Background image with progressive loading */}
      <ResponsiveImage
        src={imageUrl}
        alt={`Cover image for ${header}`}
        width={2000}
        height={1000}
        objectFit="cover"
        priority={true}
        fill={true}
        className="absolute inset-0"
      />

      <div
        className={cn(
          'absolute top-0 bottom-0 left-0 right-0',
          'bg-black opacity-30 z-10'
        )}
      />
      <div className="flex flex-col gap-1 z-20">
        <h1 className="text-5xl font-thin">{header}</h1>
        <Date dateString={date} className="text-sm text-white" />
        <div className="flex flex-row justify-center gap-1">
          <Tag text={category} href="/" primary={true} />
        </div>
      </div>
    </div>
  );
}
