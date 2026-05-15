import { useState } from 'react';
import { COMMENT_MAX_LENGTH } from '@/lib/domain/comments/constants';
import { Button } from '@/components/ui/aria/button';
import { TextAreaField } from '@/components/ui/aria/text-field';

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
      <TextAreaField
        aria-label="Comment"
        value={content}
        onChange={setContent}
        placeholder={placeholder}
        isDisabled={disabled || submitting}
        rows={3}
        maxLength={COMMENT_MAX_LENGTH}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {content.length}/{COMMENT_MAX_LENGTH}
        </span>
        <Button
          type="submit"
          isDisabled={!content.trim() || disabled}
          isPending={submitting}
          size="sm"
          className="px-4"
        >
          Post
        </Button>
        {onCancel ? (
          <Button
            type="button"
            onPress={onCancel}
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
