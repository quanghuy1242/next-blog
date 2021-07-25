import remark from 'remark'
import html from 'remark-html'
import directive from 'remark-directive'
import { directivePasers } from './directive'

export default async function markdownToHtml(markdown) {
  const result = await remark()
    .use(directive)
    .use(directivePasers)
    .use(html)
    .processSync(markdown)
  return result.toString()
}
