import { HOME_OG_IMAGE_URL } from 'common/constants';
import cn from 'classnames';

interface BannerProps {
  header?: string | null;
  subHeader?: string | null;
  className?: string;
}

export function Banner({
  header = '',
  subHeader = '',
  className,
}: BannerProps) {
  return (
    <div
      className={cn(
        'flex flex-col justify-center items-center',
        'h-banner bg-cover bg-bottom',
        'text-white text-center',
        className
      )}
      style={{ backgroundImage: `url(${HOME_OG_IMAGE_URL})` }}
    >
      <h1 className="text-7xl font-thin" style={{ lineHeight: '3.5rem' }}>
        {header}
      </h1>
      <p className="mt-8 m-3">{subHeader}</p>
    </div>
  );
}
