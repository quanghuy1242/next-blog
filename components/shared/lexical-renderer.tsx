/**
 * Lexical Renderer Component
 *
 * Renders Lexical editor state (from PayloadCMS) as React JSX.
 * Uses the official @payloadcms/richtext-lexical package with custom converters
 * for upload nodes (images) to use our custom ResponsiveImage component.
 *
 * @see https://payloadcms.com/docs/rich-text/lexical
 */

import React from 'react';
import {
  RichText,
  type JSXConvertersFunction,
} from '@payloadcms/richtext-lexical/react';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import type {
  DefaultNodeTypes,
  SerializedUploadNode,
} from '@payloadcms/richtext-lexical';
import { ResponsiveImage } from './responsive-image';

export interface LexicalRendererProps {
  /**
   * Lexical editor state (JSON) from PayloadCMS
   */
  data: SerializedEditorState | null | undefined;

  /**
   * Optional CSS class name to apply to the wrapper
   */
  className?: string;

  /**
   * Fallback content to display if data is null/undefined
   */
  fallback?: React.ReactNode;
}

/**
 * Custom upload component that uses ResponsiveImage with optimizedUrl
 */
const CustomUploadComponent: React.FC<{
  node: SerializedUploadNode;
}> = ({ node }) => {
  if (node.relationTo === 'media') {
    const uploadDoc = node.value;
    if (typeof uploadDoc !== 'object') {
      return null;
    }

    const { alt, url, optimizedUrl, lowResUrl, width, height } = uploadDoc;

    // Use optimizedUrl if available, fallback to url
    const imageUrl = optimizedUrl || url;

    // Check if we have a valid URL
    if (!imageUrl) {
      return null;
    }

    // Create media object for ResponsiveImage
    const mediaObject = {
      url,
      optimizedUrl,
      lowResUrl,
      alt,
      width,
      height,
    };

    return (
      <ResponsiveImage
        src={mediaObject}
        alt={alt || ''}
        width={width || null}
        height={height || null}
        className="my-4"
        simple={true}
      />
    );
  }

  return null;
};

/**
 * Custom CodeBlock component for rendering code blocks from PayloadCMS
 */
const CustomCodeBlock: React.FC<{
  node: any;
}> = ({ node }) => {
  const { code, language } = node?.fields || {};

  if (!code) {
    return null;
  }

  return (
    <pre className="code-block">
      <code className={language ? `language-${language}` : undefined}>
        {code}
      </code>
    </pre>
  );
};

/**
 * Custom YouTube component for rendering YouTube embeds from PayloadCMS
 */
const CustomYouTube: React.FC<{
  node: any;
}> = ({ node }) => {
  const { videoId } = node || {};

  if (!videoId) {
    return null;
  }

  return (
    <div className="youtube-embed-container">
      <iframe
        width="560"
        height="315"
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

/**
 * Custom Table component that applies column widths from backend
 */
const CustomTable: React.FC<{
  node: any;
}> = ({ node }) => {
  const colWidths = node?.colWidths || [];

  return (
    <div className="lexical-table-container">
      <table className="lexical-table">
        {colWidths.length > 0 && (
          <colgroup>
            {colWidths.map((width: number, index: number) => (
              <col key={index} style={{ width: `${width}px` }} />
            ))}
          </colgroup>
        )}
        <tbody>
          {node?.children?.map((row: any, rowIndex: number) => (
            <tr key={rowIndex} className="lexical-table-row">
              {row?.children?.map((cell: any, cellIndex: number) => {
                const isHeader = cell.headerState > 0;
                const Tag = isHeader ? 'th' : 'td';
                const headerClass =
                  cell.headerState === 1
                    ? 'lexical-table-cell-header-1'
                    : cell.headerState === 2
                    ? 'lexical-table-cell-header-2'
                    : cell.headerState === 3
                    ? 'lexical-table-cell-header-1 lexical-table-cell-header-2'
                    : '';

                // Get cell alignment from cell format
                const cellFormat = cell.format || '';
                const textAlign =
                  cellFormat === 'center'
                    ? 'center'
                    : cellFormat === 'right'
                    ? 'right'
                    : cellFormat === 'left'
                    ? 'left'
                    : undefined;

                // Combine styles
                const cellStyle: React.CSSProperties = {};
                if (cell.backgroundColor) {
                  cellStyle.backgroundColor = cell.backgroundColor;
                }
                if (textAlign) {
                  cellStyle.textAlign = textAlign;
                }

                return (
                  <Tag
                    key={cellIndex}
                    className={`lexical-table-cell ${headerClass}`.trim()}
                    colSpan={cell.colSpan || 1}
                    rowSpan={cell.rowSpan || 1}
                    style={
                      Object.keys(cellStyle).length > 0 ? cellStyle : undefined
                    }
                  >
                    {cell?.children?.map((paragraph: any, pIndex: number) => (
                      <p key={pIndex} style={{ margin: '0.2rem' }}>
                        {paragraph?.children?.map(
                          (text: any, tIndex: number) => {
                            if (text.type === 'text') {
                              let content: React.ReactNode = text.text;
                              if (text.format & 1)
                                content = (
                                  <strong key={tIndex}>{content}</strong>
                                );
                              if (text.format & 2)
                                content = <em key={tIndex}>{content}</em>;
                              return <span key={tIndex}>{content}</span>;
                            }
                            return null;
                          }
                        )}
                      </p>
                    ))}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * JSX converters for custom node types
 */
const jsxConverters: JSXConvertersFunction<DefaultNodeTypes> = ({
  defaultConverters,
}) => ({
  ...defaultConverters,
  // Override the default upload converter to use next/image
  upload: ({ node }) => {
    return <CustomUploadComponent node={node} />;
  },
  // Handle YouTube embeds
  youtube: ({ node }) => {
    return <CustomYouTube node={node} />;
  },
  // Override table rendering to apply column widths
  table: ({ node }) => {
    return <CustomTable node={node} />;
  },
  blocks: {
    ...defaultConverters.blocks,
    // Handle CodeBlock from BlocksFeature (blockType: "Code")
    Code: ({ node }) => <CustomCodeBlock node={node} />,
  },
});

/**
 * Renders Lexical rich text content from PayloadCMS
 * Styles match the PayloadCMS admin editor (sans-serif font, responsive images)
 *
 * Example usage:
 * ```tsx
 * <LexicalRenderer
 *   data={post.content}
 *   className="max-w-none"
 * />
 * ```
 */
export function LexicalRenderer({
  data,
  className = '',
  fallback = null,
}: LexicalRendererProps) {
  // Handle empty/null content
  if (!data) {
    return <>{fallback}</>;
  }

  // Combine custom lexical-content class with user-provided className
  const combinedClassName = `lexical-content ${className}`.trim();

  return (
    <div className={combinedClassName}>
      <RichText data={data} converters={jsxConverters} />
    </div>
  );
}

export default LexicalRenderer;
