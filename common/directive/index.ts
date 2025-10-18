import type { Node } from 'unist';
import visit from 'unist-util-visit';
import { htmlDirective } from './html-directive';
import { youtubeDirective } from './youtube-directive';
import type { DirectiveNode } from './types';

export type DirectiveTransformer = (tree: Node) => void;

export function directiveParsers(): DirectiveTransformer {
  function onDirective(node: DirectiveNode): void {
    switch (node.name) {
      case 'youtube':
        youtubeDirective(node);
        break;

      default:
        htmlDirective(node);
        break;
    }
  }

  function transform(tree: Node): void {
    visit(
      tree,
      ['textDirective', 'leafDirective', 'containerDirective'],
      onDirective
    );
  }

  return transform;
}
