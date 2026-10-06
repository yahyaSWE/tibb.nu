import "server-only";
import { cache } from "react";
import { getSettings } from "./db";

// Deduplicate layout/page reads in one render without retaining settings across
// requests. Mutations and booking decisions continue to read the database.
export const getSiteSettings = cache(getSettings);
