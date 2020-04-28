import CoverImage from "./cover-image";
import cn from 'classnames'
import Link from "next/link";

export default function Category({
  name,
  image,
  slug,
  className
}) {
  return <Link as="/" href="/">
    <a className={cn(className, "block relative")}>
      <CoverImage responsiveImage={image.responsiveImage} />
      <div className="absolute flex top-0 left-0 bottom-0 right-0 justify-center items-center">
        <div className="text-white md:text-3xl text-2xl">{name}</div>
      </div>
    </a>
  </Link>
}
