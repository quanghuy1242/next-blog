import { parseISO, format } from 'date-fns';

export function Date({ dateString, className }) {
  const date = parseISO(dateString);
  return (
    <time dateTime={dateString} className={className}>
      {format(date, 'LLLL	d, yyyy')}
    </time>
  );
}
