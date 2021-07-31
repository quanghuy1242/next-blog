import { HOME_OG_IMAGE_URL } from 'common/constants';

export default function Banner({
  header = '',
  subHeader = ''
}) {
  return <div
    className="h-banner bg-cover bg-bottom flex flex-col justify-center items-center text-white text-center"
    style={{ backgroundImage: `url(${HOME_OG_IMAGE_URL})` }}
  >
    <h1 className="text-7xl font-thin" style={{ lineHeight: '3.5rem' }}>{header}</h1>
    <p className="mt-8 m-3">{subHeader}</p>
  </div>
}