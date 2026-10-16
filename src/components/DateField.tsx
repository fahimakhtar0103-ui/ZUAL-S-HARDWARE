import React, { useRef } from 'react';
import { CalendarDays } from 'lucide-react';

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  min?: string;
  max?: string;
}

/**
 * Keep the native date input visible and focusable.
 * Invisible/overlaid date inputs can stop opening on Android WebView.
 */
export function DateField({ value, onChange, label, required, min, max }: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;

    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // Older Android WebViews may not support showPicker.
    }

    input.focus();
    input.click();
  };

  return (
    <div className="date-control">
      <input
        ref={inputRef}
        type="date"
        aria-label={label}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
        required={required}
        min={min}
        max={max}
        className="date-control-input"
      />
      <button
        type="button"
        className="date-control-trigger"
        aria-label={`Open ${label.toLowerCase()} calendar`}
        onClick={openPicker}
      >
        <CalendarDays size={19} aria-hidden="true" />
      </button>
    </div>
  );
}
