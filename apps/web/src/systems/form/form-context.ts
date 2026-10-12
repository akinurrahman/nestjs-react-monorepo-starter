import { createContext, useContext, useEffect } from 'react';

export type FieldRegistry = {
  // react-hook-form's own registry also holds fields a cascade has hidden,
  // and a reset empties it, so the fields actually on screen are tracked
  // here.
  onScreen: Set<string>;
  // Every field's label by name, so a gated child can name its parent the
  // way the person sees it.
  labels: Map<string, string>;
};

export const FieldRegistryContext = createContext<FieldRegistry | null>(null);

export function createFieldRegistry(): FieldRegistry {
  return { onScreen: new Set(), labels: new Map() };
}

export function useRegisterField(
  name: string,
  label: string,
  active: boolean,
): void {
  const registry = useContext(FieldRegistryContext);
  // Written during render, not in an effect: a child rendering right after
  // its parent reads the label in the same pass, so its first paint already
  // says "Select Country first". A child placed above its parent falls back
  // to the parent's name until the parent renders.
  registry?.labels.set(name, label);

  useEffect(() => {
    if (!registry || !active) return;
    registry.onScreen.add(name);
    return () => {
      registry.onScreen.delete(name);
    };
  }, [registry, name, active]);
}

export function useFieldLabels(): (name: string) => string {
  const registry = useContext(FieldRegistryContext);
  return (name) => registry?.labels.get(name) ?? name;
}
