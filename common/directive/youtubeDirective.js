export function youtubeDirective(node) {
  const { name, attributes, children } = node
  const text = children[0]?.value ?? "";

  if (name !== "youtube") {
    return;
  }

  const { v: id, src, ...restOfAttributes } = attributes
  Object.assign(node, {
    type: "containerDirective",
    name: "div",
    children: [{
      ...JSON.parse(JSON.stringify(node)),
      name: "parsed-youtube",
      data: {
        parsed: true,
        hName: "iframe",
        hProperties: {
          width: "560",
          height: "315",
          title: text,
          src: `https://www.youtube.com/embed/${id}`,
          frameborder: "0",
          class: "youtube-content",
          allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
          ...restOfAttributes
        }
      }
    }],
    data: {
      hName: 'div',
      hProperties: {
        class: "youtube-container"
      }
    }
  })
}
