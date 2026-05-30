import { useId, useState } from 'react';
import { cx, ui } from '../styles/tailwindClasses.js';

export function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  required = false,
  disabled = false,
  labelClassName,
  inputClassName,
}) {
  const generatedId = useId();
  const fieldId = `${generatedId}-${name || 'password'}`;
  const [visible, setVisible] = useState(false);

  return (
    <label htmlFor={fieldId} className={cx(ui.formLabel, labelClassName)}>
      {label}
      <span className="relative block">
        <input
          id={fieldId}
          className={cx(ui.input, 'pr-[92px]', inputClassName)}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 inline-flex min-h-11 -translate-y-1/2 items-center justify-center rounded-md border border-line-soft bg-surface-2 px-3 text-[12px] font-extrabold text-ink-medium transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </span>
    </label>
  );
}
