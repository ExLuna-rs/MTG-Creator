import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";

/** Champ de formulaire : libellé, aide facultative et message d'erreur. */
export function FormField({
  id,
  label,
  hint,
  error,
  ...props
}: ComponentProps<"input"> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-medium text-sm">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
