import { h } from 'hastscript'

export function htmlDirectiver(node) {
  let data = node.data || (node.data = {})
  let hast = h(node.name, node.attributes)

  data.hName = hast.tagName
  data.hProperties = hast.properties
}
