'use client';

import type { ReactNode } from 'react';
import cn from 'classnames';
import {
  FieldError as AriaFieldError,
  Input,
  Label,
  Text,
  TextArea,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components/TextField';

type ErrorMessage = ReactNode;

interface BaseFieldProps
  extends Omit<
    AriaTextFieldProps,
    'children' | 'className' | 'spellCheck' | 'autoCapitalize' | 'autoCorrect'
  > {
  label?: ReactNode;
  description?: ReactNode;
  errorMessage?: ErrorMessage;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}

export interface TextFieldProps extends BaseFieldProps {
  type?: AriaTextFieldProps['type'];
  autoCapitalize?: string;
  autoCorrect?: string;
  spellCheck?: boolean | 'true' | 'false';
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
}

export interface TextAreaFieldProps extends BaseFieldProps {
  rows?: number;
  maxLength?: number;
}

export function getInputClassName({
  hasError = false,
  className,
}: {
  hasError?: boolean;
  className?: string;
} = {}) {
  return cn(
    'input input-bordered w-full bg-base-100 text-base-content placeholder:text-base-content/40',
    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
    hasError && 'input-error',
    className
  );
}

export function TextField({
  label,
  description,
  errorMessage,
  className,
  inputClassName,
  placeholder,
  startAdornment,
  endAdornment,
  isInvalid,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField
      {...props}
      isInvalid={isInvalid}
      className={cn('fieldset gap-1 p-0', className)}
    >
      {label ? <Label className="label text-sm font-medium text-base-content">{label}</Label> : null}
      <div className="relative">
        {startAdornment ? (
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-primary/70">
            {startAdornment}
          </div>
        ) : null}
        <Input
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          spellCheck={spellCheck}
          placeholder={placeholder}
          className={getInputClassName({
            hasError: Boolean(isInvalid),
            className: cn(
              startAdornment ? 'pl-9' : undefined,
              endAdornment ? 'pr-11' : undefined,
              inputClassName
            ),
          })}
        />
        {endAdornment ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{endAdornment}</div>
        ) : null}
      </div>
      {description ? (
        <Text slot="description" className="label pt-1 text-xs text-base-content/60">
          {description}
        </Text>
      ) : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
}

export function TextAreaField({
  label,
  description,
  errorMessage,
  className,
  inputClassName,
  placeholder,
  rows = 3,
  maxLength,
  isInvalid,
  ...props
}: TextAreaFieldProps) {
  return (
    <AriaTextField
      {...props}
      isInvalid={isInvalid}
      className={cn('fieldset gap-1 p-0', className)}
    >
      {label ? <Label className="label text-sm font-medium text-base-content">{label}</Label> : null}
      <TextArea
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className={cn(
          'textarea textarea-bordered w-full bg-base-100 text-base-content placeholder:text-base-content/40',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
          isInvalid && 'textarea-error',
          inputClassName
        )}
      />
      {description ? (
        <Text slot="description" className="label pt-1 text-xs text-base-content/60">
          {description}
        </Text>
      ) : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaTextField>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) {
    return null;
  }

  return (
    <AriaFieldError className="validator-hint text-sm text-error">
      {children}
    </AriaFieldError>
  );
}
