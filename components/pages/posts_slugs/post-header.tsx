import cn from 'classnames';
import { Date } from 'components/shared/date';
import { Tag } from 'components/shared/tags';
import { getMediaUrl } from 'common/utils/image';
import type { Media } from 'types/cms';

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
    <div
      className={cn(
        'flex flex-col justify-center items-center',
        'h-banner',
        'text-white text-center',
        'relative overflow-hidden',
        className
      )}
    >
      {/* Background image - use optimizedUrl directly with CSS */}
      {lowResUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lowResUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            aspectRatio: '2 / 1', // Mimic 2000x1000 (2:1) wide effect
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverUrl}
        alt={`Cover image for ${header}`}
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{
          aspectRatio: '2 / 1', // Mimic 2000x1000 (2:1) wide effect
        }}
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
