import cn from 'classnames';
import { Date } from 'components/shared/date';
import { Tag } from 'components/shared/tags';
import { ResponsiveImage } from 'components/shared/responsive-image';
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
  if (!coverImage) {
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
      {/* Background blur image */}
      {coverImage.lowResUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImage.lowResUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            aspectRatio: '2 / 1',
          }}
        />
      )}
      {/* Main image */}
      <ResponsiveImage
        src={coverImage}
        alt={`Cover image for ${header}`}
        width={2000}
        height={1000}
        className="absolute inset-0 w-full h-full object-cover object-center"
        priority
        sizes="100vw"
        quality={75}
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
