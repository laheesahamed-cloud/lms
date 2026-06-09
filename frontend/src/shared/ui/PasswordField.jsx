import { useId, useState } from 'react';
import { cx, ui } from '../styles/tailwindClasses.js';

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

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
  ariaDescribedBy,
  ariaInvalid,
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
          className={cx(ui.input, 'pr-14', inputClassName)}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
          aria-required={required || undefined}
          aria-invalid={ariaInvalid || undefined}
          aria-describedby={ariaDescribedBy || undefined}
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 inline-flex size-11 min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent p-0 text-ink-soft transition-[background,color,transform] duration-150 hover:bg-surface-2 hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
    </label>
  );
}
