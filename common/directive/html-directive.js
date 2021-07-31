import { h } from 'hastscript';

export function htmlDirective(node) {
  let data = node.data || (node.data = {});
  let hast = h(node.name, node.attributes);

  if (data?.parsed) {
    return;
  }

  data.hName = hast.tagName;
  data.hProperties = hast.properties;
}
