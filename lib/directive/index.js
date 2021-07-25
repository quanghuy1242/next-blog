import visit from 'unist-util-visit'
import { htmlDirectiver } from './htmlDirective'
import { youtubeDirective } from './youtubeDirective'

export function directivePasers() {
  function ondirective(node) {
    switch (node.name) {
      case "youtube":
        youtubeDirective(node)
        break;
    
      default:
        htmlDirectiver(node)
        break;
    }
  }

  function transform(tree) {
    visit(tree, ['textDirective', 'leafDirective', 'containerDirective'], ondirective)
  }

  return transform
}
