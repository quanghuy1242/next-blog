/**
 * `::youtube{#75NDStr8wF4}`
 * `::youtube{v='75NDStr8wF4'}`
 * `::youtube[https://www.youtube.com/watch?v=75NDStr8wF4]`
 */
export function youtubeDirective(node) {
  const { name, attributes, children } = node;
  const text = children[0]?.value ?? '';

  if (name !== 'youtube') {
    return;
  }

  // Get youtube id
  const youtubeIdFromLabel = getYoutubeIdFromUrl(text);
  const {
    id: youtubeIdFromAttributes,
    v: youtubeIdFromV,
    src,
    ...restOfAttributes
  } = attributes;

  // Select one of 3 ids
  const youtubeId =
    youtubeIdFromAttributes ||
    youtubeIdFromV ||
    youtubeIdFromLabel ||
    '75NDStr8wF4'; // Default video

  Object.assign(node, {
    type: 'containerDirective',
    name: 'div',
    children: [
      {
        ...JSON.parse(JSON.stringify(node)),
        name: 'parsed-youtube',
        data: {
          parsed: true,
          hName: 'iframe',
          hProperties: {
            width: '560',
            height: '315',
            title: text,
            src: `https://www.youtube.com/embed/${youtubeId}`,
            frameborder: '0',
            class: 'youtube-content',
            allow:
              'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture',
            ...restOfAttributes,
          },
        },
      },
    ],
    data: {
      hName: 'div',
      hProperties: {
        class: 'youtube-container',
      },
    },
  });
}

function getYoutubeIdFromUrl(url) {
  const regex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  return `${url}`.match(regex)?.[2] || null;
}
