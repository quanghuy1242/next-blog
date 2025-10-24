import cn from 'classnames';
import Image from 'next/image';
import { Date } from 'components/shared/date';
import { Tag } from 'components/shared/tags';
import { getCoverImageUrl, getBlurPlaceholder } from 'common/utils/image';

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
  // Apply R2 transformations for optimized banner image
  const optimizedImageUrl = getCoverImageUrl(imageUrl, 2000, 1000, 75);
  const blurDataURL = getBlurPlaceholder(imageUrl);

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
      {/* Background image with Next.js Image optimization */}
      <Image
        src={optimizedImageUrl}
        alt={`Cover image for ${header}`}
        fill
        className="object-cover"
        placeholder="blur"
        blurDataURL={blurDataURL}
        priority // Banner images should load with priority
        unoptimized // R2 handles transformations
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
