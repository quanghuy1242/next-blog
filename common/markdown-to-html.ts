import remark from 'remark';
import directive from 'remark-directive';
import html from 'remark-html';
import { directiveParsers } from './directive';

export default async function markdownToHtml(markdown: string): Promise<string> {
  const result = await remark()
    .use(directive)
    .use(directiveParsers)
    .use(html)
    .process(markdown);

  return result.toString();
}
