import { SelectHTMLAttributes, useId } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  loading?: boolean;
};

export function Select({ label, error, loading = false, id, className, children, disabled, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <label className="field" htmlFor={selectId}>
      <span className="field__label">{label}</span>
      <select
        id={selectId}
        className={['select-input', error ? 'select-input--error' : '', className].filter(Boolean).join(' ')}
        disabled={disabled || loading}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...props}
      >
        {children}
      </select>
      {loading ? <span className="field__hint">加载中...</span> : null}
      {error ? (
        <span className="field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
