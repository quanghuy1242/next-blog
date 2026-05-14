import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';
import Link from 'next/link';
import type { LinkProps } from 'next/link';
import cn from 'classnames';
import { SSRPrefetchLink } from '@/components/shared/ssr-prefetch-link';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type TextActionVariant = 'neutral' | 'danger';

interface ButtonClassNameOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

export function getButtonClassName({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonClassNameOptions = {}) {
  return cn(
    'inline-flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
    {
      'bg-blue text-white hover:bg-darkBlue': variant === 'primary',
      'border border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900':
        variant === 'secondary',
      'text-gray-600 hover:text-gray-900': variant === 'ghost',
      'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
      'rounded px-3 py-1.5 text-sm font-medium': size === 'sm',
      'rounded px-4 py-2 text-sm font-medium': size === 'md',
      'h-11 rounded-xl px-4 text-sm font-semibold': size === 'lg',
      'w-full': fullWidth,
    },
    className
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={getButtonClassName({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}

interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  hardNavigate?: boolean;
  ssrPrefetch?: boolean;
  prefetch?: LinkProps['prefetch'];
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  hardNavigate = false,
  ssrPrefetch = false,
  prefetch,
  className,
  ...props
}: ButtonLinkProps) {
  const composedClassName = getButtonClassName({
    variant,
    size,
    fullWidth,
    className,
  });

  if (hardNavigate) {
    return (
      <a href={href} className={composedClassName} {...props}>
        {children}
      </a>
    );
  }

  if (ssrPrefetch) {
    return (
      <SSRPrefetchLink href={href} prefetch={prefetch} className={composedClassName} {...props}>
        {children}
      </SSRPrefetchLink>
    );
  }

  return (
    <Link href={href} prefetch={prefetch} className={composedClassName} {...props}>
      {children}
    </Link>
  );
}

interface TextActionButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TextActionVariant;
}

export function TextActionButton({
  variant = 'neutral',
  className,
  type = 'button',
  ...props
}: TextActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'danger'
          ? 'text-red-600 hover:text-red-800'
          : 'text-gray-500 hover:text-gray-700',
        className
      )}
      {...props}
    />
  );
}
