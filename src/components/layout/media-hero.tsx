import type { ReactNode } from 'react';
import cn from 'classnames';

interface MediaHeroProps {
  title: ReactNode;
  subtitle?: ReactNode;
  imageUrl: string;
  imageAlt: string;
  lowResUrl?: string | null;
  objectPosition?: string;
  className?: string;
  overlay?: boolean;
  children?: ReactNode;
}

export function MediaHero({
  title,
  subtitle,
  imageUrl,
  imageAlt,
  lowResUrl,
  objectPosition = 'object-center',
  className,
  overlay = true,
  children,
}: MediaHeroProps) {
  return (
    <section
      className={cn(
        'hero relative h-banner overflow-hidden text-center text-white',
        className
      )}
    >
      {lowResUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lowResUrl}
          alt=""
          aria-hidden="true"
          className={cn('absolute inset-0 h-full w-full scale-110 object-cover blur-2xl', objectPosition)}
          style={{ aspectRatio: '2 / 1' }}
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={imageAlt}
        loading="eager"
        fetchPriority="high"
        className={cn('absolute inset-0 h-full w-full object-cover', objectPosition)}
        style={{ aspectRatio: '2 / 1' }}
      />
      {overlay ? <div className="absolute inset-0 z-10 bg-black/30" /> : null}
      <div className="hero-content relative z-20 flex-col gap-2">
        <h1 className="text-5xl font-thin leading-tight md:text-7xl">{title}</h1>
        {subtitle ? <div className="mt-2">{subtitle}</div> : null}
        {children}
      </div>
    </section>
  );
}
