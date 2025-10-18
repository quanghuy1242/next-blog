import { h } from 'hastscript';
import type { DirectiveNode } from './types';

export function htmlDirective(node: DirectiveNode): void {
  if (!node.name) {
    return;
  }

  const data = node.data ?? (node.data = {});
  const hast = h(node.name, node.attributes ?? {});

  if (data.parsed) {
    return;
  }

  data.hName = hast.tagName;
  data.hProperties = hast.properties;
}
