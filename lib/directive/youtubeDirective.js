export function youtubeDirective(node) {
  const { name, attributes, children } = node
  const text = children[0]?.value ?? "";

  let data = node.data || (node.data = {})

  if (name !== "youtube") {
    return;
  }

  const { v: id, src, ...restOfAttributes } = attributes

  data.hName = "iframe"
  data.hProperties = {
    width: "560",
    height: "315",
    title: text,
    src: `https://www.youtube.com/embed/${id}`,
    frameborder: "0",
    allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
    ...restOfAttributes
  }
}