import { useState } from 'react';

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
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!content.trim() || disabled || submitting}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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