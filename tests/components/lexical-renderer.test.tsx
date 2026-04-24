import React from 'react';
import { render, screen } from '@testing-library/react';
import { LexicalRenderer } from 'components/shared/lexical-renderer';

vi.mock('@payloadcms/richtext-lexical/react', () => ({
  RichText: ({ converters }: { converters: Record<string, (args: any) => React.ReactNode> }) => {
    const uploadNode = {
      relationTo: 'media',
      value: null,
    };

    return <div data-testid="rich-text">{converters.upload?.({ node: uploadNode })}</div>;
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
});