import visit from 'unist-util-visit'
import { htmlDirective } from './htmlDirective'
import { youtubeDirective } from './youtubeDirective'

export function directiveParsers() {
  function ondirective(node) {
    switch (node.name) {
      case "youtube":
        youtubeDirective(node)
        break;
    
      default:
        htmlDirective(node)
        break;
    }
  }

  function transform(tree) {
    visit(tree, ['textDirective', 'leafDirective', 'containerDirective'], ondirective)
  }

  return transform
}
