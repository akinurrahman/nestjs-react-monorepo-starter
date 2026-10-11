import { Monitor, Moon, Sun } from 'lucide-react';
import { createLookup } from '@/lib/lookup/create-lookup';

export const themeLookup = createLookup(
  {
    light: { label: 'Light', icon: Sun },
    dark: { label: 'Dark', icon: Moon },
    system: { label: 'System', icon: Monitor },
  },
  'Theme',
);

export type Theme = (typeof themeLookup.values)[number];
export type ResolvedTheme = Exclude<Theme, 'system'>;
