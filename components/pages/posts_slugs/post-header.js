import cn from 'classnames';
import { Date } from 'components/shared/date';
import { Tag } from 'components/shared/tags';

export function PostHeader({ header, date, category, imageUrl, className }) {
  return (
    <div
      className={cn(
        'flex flex-col justify-center items-center',
        'h-banner bg-cover bg-center',
        'text-white text-center',
        'relative',
        className
      )}
      style={{ backgroundImage: `url(${imageUrl})` }}
    >
      <div
        className={cn(
          'absolute top-0 bottom-0 left-0 right-0',
          'bg-black opacity-30 z-5'
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
