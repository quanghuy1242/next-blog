export default function Avatar({ name, picture }) {
  return (
    <div className="flex items-center">
      <img
        src={picture.url}
        className="w-10 h-w-10 rounded-full mr-4"
        alt={name}
      />
      <div className="text-sm font-bold">{name}</div>
    </div>
  )
}
