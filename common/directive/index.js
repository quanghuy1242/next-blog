import visit from 'unist-util-visit';
import { htmlDirective } from './html-directive';
import { youtubeDirective } from './youtube-directive';

export function directiveParsers() {
  function onDirective(node) {
    switch (node.name) {
      case 'youtube':
        youtubeDirective(node);
        break;

      default:
        htmlDirective(node);
        break;
    }
  }

  function transform(tree) {
    visit(
      tree,
      ['textDirective', 'leafDirective', 'containerDirective'],
      onDirective
    );
  }

  return transform;
}
