import { z } from 'zod';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive';

// Icon is whatever component the config passes, inferred from it, so lib
// stays free of React. It is never when no entry has one, and the code that
// renders an entry (systems/ui/lookup-badge) names the type it accepts.
export type LookupEntry<Icon = never> = {
  label: string;
  badgeVariant?: BadgeVariant;
  icon?: Icon;
  iconClassName?: string;
  className?: string;
};

export type LookupConfig<T extends string, Icon = never> = Record<
  T,
  LookupEntry<Icon>
>;

export type LookupOption<T extends string> = { value: T; label: string };

export function createLookup<T extends string, Icon = never>(
  config: LookupConfig<T, Icon>,
  name?: string,
) {
  const values = Object.keys(config) as T[];

  const keys = Object.fromEntries(values.map((value) => [value, value])) as {
    readonly [K in T]: K;
  };

  const options: LookupOption<T>[] = values.map((value) => ({
    value,
    label: config[value].label,
  }));

  function resolve(value: string | null | undefined): LookupEntry<Icon> | null {
    if (value && Object.hasOwn(config, value)) return config[value as T];
    // Empty is a legitimate "not set". An unknown value means the api grew a
    // member this lookup has not caught up with.
    if (value && import.meta.env.DEV) {
      console.warn(
        `[lookup${name ? `:${name}` : ''}] Unknown value "${value}". Expected one of: ${values.join(', ')}`,
      );
    }
    return null;
  }

  // A message replaces zod's "expected one of ...", which shows wire values
  // to someone who simply picked nothing.
  function toZodEnum(message?: string) {
    return z.enum(
      values as [T, ...T[]],
      message ? { error: message } : undefined,
    );
  }

  return { keys, values: values as readonly T[], options, resolve, toZodEnum };
}
