import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combine des classes Tailwind en résolvant les conflits. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
