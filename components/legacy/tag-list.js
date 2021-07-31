import Badge from './badge';

export default function TagList({ items = [] }) {
  return (
    <div className="flex flex-wrap">
      <h3 className="mr-1 font-bold">Tags: </h3>
      {items.map((item) => (
        <Badge
          text={item}
          link={{ as: `/`, href: '/' }}
          className="mr-1"
          key={item}
        />
      ))}
    </div>
  );
}
