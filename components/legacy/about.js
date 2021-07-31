import Title from './title';
import CoverImage from './cover-image';

export default function About({ displayName, picture, description }) {
  return (
    <div className="mt-2">
      <Title text={`About me: ${displayName}`} />
      <div
        className="text-sm mb-2"
        dangerouslySetInnerHTML={{ __html: description }}
      />
      <div className="md:pr-12 md:pb-12">
        <CoverImage responsiveImage={picture.responsiveImage} />
      </div>
    </div>
  );
}
