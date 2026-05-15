import { useState } from 'react';
import { COMMENT_MAX_LENGTH } from '@/lib/domain/comments/constants';
import { Button } from '@/components/shared/ui/button';
import { getInputClassName } from '@/components/shared/ui/form-control';

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
        className={getInputClassName()}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {content.length}/{COMMENT_MAX_LENGTH}
        </span>
        <Button
          type="submit"
          disabled={!content.trim() || disabled || submitting}
          size="sm"
          className="px-4"
        >
          {submitting ? 'Posting...' : 'Post'}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            onClick={onCancel}
            variant="ghost"
            size="sm"
            className="px-4"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
