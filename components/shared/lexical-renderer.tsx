/**
 * Lexical Renderer Component
 *
 * Renders Lexical editor state (from PayloadCMS) as React JSX.
 * Uses the official @payloadcms/richtext-lexical package.
 *
 * @see https://payloadcms.com/docs/rich-text/lexical
 */

import React from 'react';
import { RichText } from '@payloadcms/richtext-lexical/react';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';

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
      <RichText data={data} />
    </div>
  );
}

export default LexicalRenderer;
