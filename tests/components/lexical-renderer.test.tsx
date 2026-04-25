import React from 'react';
import { render, screen } from '@testing-library/react';
import { LexicalRenderer } from 'components/shared/lexical-renderer';

vi.mock('@payloadcms/richtext-lexical/react', () => ({
  RichText: ({ converters }: { converters: any }) => {
    const defaultConverters = {
      upload: ({ node }: { node: { relationTo: string } }) => (
        <span data-testid="default-upload">{node.relationTo}</span>
      ),
    };

    const resolvedConverters =
      typeof converters === 'function'
        ? converters({ defaultConverters })
        : converters ?? defaultConverters;

    const uploadNode = {
      relationTo: 'media',
      value: null,
    };

    const epubNode = {
      type: 'epub-internal-link',
      fields: {
        epubHref: '../Text/02.htm#section-3',
      },
      children: [
        {
          type: 'text',
          version: 1,
          text: 'Next chapter',
          format: 0,
          mode: 'normal',
          style: '',
          detail: 0,
        },
      ],
    };

    return (
      <div data-testid="rich-text">
        <div data-testid="upload">{resolvedConverters.upload?.({ node: uploadNode })}</div>
        <div data-testid="epub-link">
          {resolvedConverters['epub-internal-link']?.({
            node: epubNode,
            nodesToJSX: ({ nodes }: { nodes: Array<{ text?: string }> }) =>
              nodes.map((node) => node.text ?? ''),
            converters: resolvedConverters,
            parent: epubNode,
            childIndex: 0,
          })}
        </div>
      </div>
    );
  },
}));

describe('LexicalRenderer', () => {
  test('does not crash when upload relationship value is null', () => {
    const data = {
      root: {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    } as any;

    expect(() => {
      render(<LexicalRenderer data={data} />);
    }).not.toThrow();

    expect(screen.getByTestId('rich-text')).toBeInTheDocument();
  });

  test('renders epub internal links as chapter links when context is available', () => {
    const data = {
      root: {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    } as any;

    render(
      <LexicalRenderer
        data={data}
        epubLinkContext={{
          bookSlug: 'sample-book',
          chapters: [
            {
              slug: 'chapter-two',
              chapterSourceKey: 'toc-2::OEBPS/Text/02.htm::chapter-3',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Next chapter' })).toHaveAttribute(
      'href',
      '/books/sample-book/chapters/chapter-two#section-3',
    );
  });
});
