import { HOME_OG_IMAGE_URL } from '../lib/constants';

export default function Banner() {
  return <div
    className="h-banner bg-cover bg-bottom flex flex-col justify-center items-center text-white text-center"
    style={{ backgroundImage: `url(${HOME_OG_IMAGE_URL})` }}
  >
    <h1 className="text-7xl font-thin" style={{ lineHeight: '3.5rem' }}>Dark Blue Pattern</h1>
    <p className="mt-8 m-3">Đôi khi, có vệt sáng vụt qua rồi lại vỡ tan trên bầu trời đêm đầy hy vọng</p>
  </div>
}