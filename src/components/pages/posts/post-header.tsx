import cn from 'classnames';
import { Date } from '@/components/shared/date';
import { Tag } from '@/components/shared/tags';
import { MediaHero } from '@/components/layout/media-hero';
import { getMediaUrl } from '@/lib/shared/image';
import type { Media } from '@/types/cms';

interface PostHeaderProps {
  header: string;
  date: string;
  category: string;
  coverImage: Media | null | undefined;
  className?: string;
}

export function PostHeader({
  header,
  date,
  category,
  coverImage,
  className,
}: PostHeaderProps) {
  const coverUrl = getMediaUrl(coverImage);
  const lowResUrl = coverImage?.lowResUrl;

  if (!coverUrl) {
    return null;
  }

  return (
    <MediaHero
      title={header}
      imageUrl={coverUrl}
      imageAlt={`Cover image for ${header}`}
      lowResUrl={lowResUrl}
      className={cn('w-full', className)}
    >
      <Date dateString={date} className="text-sm text-white" />
      <div className="flex flex-row justify-center gap-1">
        <Tag text={category} href="/" primary={true} />
      </div>
    </MediaHero>
  );
}
