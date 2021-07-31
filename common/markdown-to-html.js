import remark from 'remark';
import directive from 'remark-directive';
import html from 'remark-html';
import { directiveParsers } from './directive';

export default async function markdownToHtml(markdown) {
  const result = await remark()
    .use(directive)
    .use(directiveParsers)
    .use(html)
    .processSync(markdown);
  return result.toString();
}
