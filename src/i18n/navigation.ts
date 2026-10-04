import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Équivalents de next/link et next/navigation qui tiennent compte de la langue.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
