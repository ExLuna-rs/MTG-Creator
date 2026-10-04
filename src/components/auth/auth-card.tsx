import type { ReactNode } from "react";

/** Mise en page des pages de connexion, d'inscription et de mot de passe. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="space-y-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
        {children}
      </div>
      {footer && (
        <div className="mt-6 text-center text-muted-foreground text-sm">
          {footer}
        </div>
      )}
    </div>
  );
}
