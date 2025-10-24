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
 * Custom upload component that uses our ResponsiveImage for optimized images
 */
const CustomUploadComponent: React.FC<{
  node: SerializedUploadNode;
}> = ({ node }) => {
  if (node.relationTo === 'media') {
    const uploadDoc = node.value;
    if (typeof uploadDoc !== 'object') {
      return null;
    }

    const { alt, height, url, width, lowResUrl } = uploadDoc;

    // Handle missing URL
    if (!url) {
      return null;
    }

    return (
      <ResponsiveImage
        src={url}
        alt={alt || ''}
        width={width || null}
        height={height || null}
        lowResUrl={lowResUrl || null}
        className="my-4"
        objectFit="contain"
      />
    );
  }

  return null;
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
});

/**
 * Renders Lexical rich text content from PayloadCMS
 * Styles match the PayloadCMS admin editor (sans-serif font, responsive images)
 *
 * Example usage:
 * ```tsx
 * <LexicalRenderer
 *   data={post.content}
 *   className="prose prose-lg max-w-none"
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
