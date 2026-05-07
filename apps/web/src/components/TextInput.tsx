import { forwardRef, InputHTMLAttributes, useId } from 'react';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, error, id, className, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">{label}</span>
      <input
        id={inputId}
        className={['text-input', error ? 'text-input--error' : '', className].filter(Boolean).join(' ')}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        ref={ref}
        {...props}
      />
      {error ? (
        <span className="field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
});
