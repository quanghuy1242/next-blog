import { useState } from 'react';
import { COMMENT_MAX_LENGTH } from 'common/constants/comments';

interface CommentComposerProps {
  onSubmit: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  parentId?: string;
  onCancel?: () => void;
}

export function CommentComposer({
  onSubmit,
  disabled = false,
  placeholder = 'Write a comment...',
  onCancel,
}: CommentComposerProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || disabled || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setContent('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || submitting}
        rows={3}
        maxLength={COMMENT_MAX_LENGTH}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {content.length}/{COMMENT_MAX_LENGTH}
        </span>
        <button
          type="submit"
          disabled={!content.trim() || disabled || submitting}
          className="rounded bg-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-darkBlue disabled:opacity-50"
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-4 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
