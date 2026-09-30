import { useEffect, useRef } from "react";

import { lengthHint, lengthTone, type LengthTone } from "../seo/length";
import { charLength, type LengthRange } from "../seo/text";

interface SeoFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  range?: LengthRange;
  multiline?: boolean;
  placeholder?: string;
  /** Counter tone when the field is empty (amber for optional-ish fields). */
  emptyTone?: LengthTone;
  emptyHint?: string;
  error?: string;
}

/**
 * A Polaris text field with a live character counter. The counter uses the
 * same length rules as the audit, so green here means the check will pass.
 */
export function SeoField({
  label,
  name,
  value,
  onChange,
  range,
  multiline = false,
  placeholder,
  emptyTone = "critical",
  emptyHint,
  error,
}: SeoFieldProps) {
  const fieldRef = useRef<HTMLElementTagNameMap["s-text-field"]>(null);
  const areaRef = useRef<HTMLElementTagNameMap["s-text-area"]>(null);

  // React 18 sets custom-element props as attributes. Like a native input,
  // the `value` attribute is only the initial value (it's what the server
  // render shows); once the field is edited, the property wins. Push
  // programmatic changes (e.g. "Use suggestion") to the property directly.
  useEffect(() => {
    const element = multiline ? areaRef.current : fieldRef.current;
    if (element && element.value !== value) element.value = value;
  }, [value, multiline]);

  const length = charLength(value);
  const shared = {
    label,
    name,
    placeholder,
    error,
    value,
  };

  return (
    <s-stack direction="block" gap="small-200">
      {multiline ? (
        <s-text-area
          ref={areaRef}
          rows={3}
          {...shared}
          onInput={(event) => onChange(event.currentTarget.value)}
        />
      ) : (
        <s-text-field
          ref={fieldRef}
          {...shared}
          onInput={(event) => onChange(event.currentTarget.value)}
        />
      )}
      {range && (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone={lengthTone(length, range, emptyTone)}>
            {`${length} / ${range.max}`}
          </s-badge>
          <s-text color="subdued">
            {length === 0 && emptyHint ? emptyHint : lengthHint(length, range)}
          </s-text>
        </s-stack>
      )}
    </s-stack>
  );
}
