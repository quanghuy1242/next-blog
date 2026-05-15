'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import NextLink from 'next/link';
import type { LinkProps as NextLinkProps } from 'next/link';
import cn from 'classnames';
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from 'react-aria-components/Button';
import { Link as AriaLink } from 'react-aria-components/Link';
import { composeRenderProps } from 'react-aria-components/composeRenderProps';
import { tv } from 'tailwind-variants';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
export type TextActionVariant = 'neutral' | 'danger';

interface ButtonClassNameOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

const buttonStyles = tv({
  base: [
    'btn',
    'focus:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-primary',
    'focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed',
    'disabled:opacity-60',
    'data-[disabled]:cursor-not-allowed',
    'data-[disabled]:opacity-60',
    'pressed:scale-[0.98]',
  ],
  variants: {
    variant: {
      primary: 'btn-primary',
      secondary: 'btn-secondary btn-outline',
      ghost: 'btn-ghost',
      danger: 'btn-error',
    },
    size: {
      sm: 'btn-sm',
      md: '',
      lg: 'btn-lg',
      icon: 'btn-square btn-sm',
    },
    fullWidth: {
      true: 'w-full',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export function getButtonClassName({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonClassNameOptions = {}) {
  return buttonStyles({ variant, size, fullWidth, className });
}

export interface ButtonProps
  extends Omit<AriaButtonProps, 'className' | 'isDisabled'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
  isDisabled?: boolean;
  pendingLabel?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  disabled,
  isDisabled,
  pendingLabel = 'Loading',
  children,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      isDisabled={isDisabled ?? disabled}
      className={composeRenderProps(className, (renderClassName, renderProps) =>
        getButtonClassName({
          variant,
          size,
          fullWidth,
          className: cn(renderClassName, {
            'pointer-events-none': renderProps.isPending,
          }),
        })
      )}
    >
      {composeRenderProps(children, (buttonChildren, { isPending }) => (
        <>
          {isPending ? (
            <span className="loading loading-spinner loading-sm" aria-label={pendingLabel} />
          ) : null}
          <span className={cn(isPending && 'opacity-70')}>{buttonChildren}</span>
        </>
      ))}
    </AriaButton>
  );
}

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: NextLinkProps['href'];
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  hardNavigate?: boolean;
  prefetch?: NextLinkProps['prefetch'];
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  hardNavigate = false,
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

  if (hardNavigate || typeof href === 'string' && isExternalHref(href)) {
    return (
      <a href={typeof href === 'string' ? href : '#'} className={composedClassName} {...props}>
        {children}
      </a>
    );
  }

  if (typeof href === 'string') {
    return (
      <AriaLink
        href={href}
        className={composedClassName}
        render={(linkProps) => (
          <NextLink
            {...(linkProps as AnchorHTMLAttributes<HTMLAnchorElement>)}
            href={href}
            prefetch={prefetch}
            className={composedClassName}
            {...props}
          >
            {children}
          </NextLink>
        )}
      >
        {children}
      </AriaLink>
    );
  }

  return (
    <NextLink href={href} prefetch={prefetch} className={composedClassName} {...props}>
      {children}
    </NextLink>
  );
}

export interface TextActionButtonProps
  extends Omit<ButtonProps, 'variant' | 'size' | 'fullWidth'> {
  variant?: TextActionVariant;
}

export function TextActionButton({
  variant = 'neutral',
  className,
  ...props
}: TextActionButtonProps) {
  return (
    <Button
      {...props}
      variant="ghost"
      size="sm"
      className={cn(
        'h-auto min-h-0 px-1 py-0 text-xs font-medium',
        variant === 'danger'
          ? 'text-error hover:bg-error/10'
          : 'text-base-content/60 hover:bg-base-200 hover:text-base-content',
        className
      )}
    />
  );
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//.test(href);
}
