import { useMemo, useSyncExternalStore } from 'react';
import themeCss from '@/styles/theme.css?raw';
import { PreviewSection, Specimen } from './preview-layout';

const NON_COLOR = new Set(['font-sans', 'font-mono', 'radius']);

// Read from theme.css itself, so a token added there shows up here without
// anyone remembering to list it.
const ROOT_BLOCK = /:root\s*\{([^}]*)\}/.exec(themeCss)?.[1] ?? '';
const TOKENS = [...ROOT_BLOCK.matchAll(/--([a-z0-9-]+)\s*:/g)].map(
  (match) => match[1]!,
);
const COLOR_TOKENS = TOKENS.filter((name) => !NON_COLOR.has(name));
const PAIRED = COLOR_TOKENS.filter(
  (name) =>
    !name.endsWith('-foreground') &&
    COLOR_TOKENS.includes(`${name}-foreground`),
);

// Spelled out, since Tailwind only generates classes it finds in the source.
const TINTS = [
  { name: 'primary', className: 'bg-primary/15 text-primary' },
  { name: 'destructive', className: 'bg-destructive/15 text-destructive' },
  { name: 'success', className: 'bg-success/15 text-success' },
  { name: 'warning', className: 'bg-warning/15 text-warning' },
  { name: 'info', className: 'bg-info/15 text-info' },
];

const RADII = [
  'rounded-sm',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-3xl',
  'rounded-4xl',
];

const FONTS = [
  { name: 'font-sans', className: 'font-sans' },
  { name: 'font-mono', className: 'font-mono' },
];

function subscribeToRootClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
  return () => observer.disconnect();
}

// The resolved values follow the .dark class, whichever way it changes.
function useTokenValues(): Record<string, string> {
  const rootClass = useSyncExternalStore(
    subscribeToRootClass,
    () => document.documentElement.className,
  );

  return useMemo(() => {
    // Read again whenever the root class changes.
    void rootClass;
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      TOKENS.map((name) => [
        name,
        styles.getPropertyValue(`--${name}`).trim().replace(/\s+/g, ' '),
      ]),
    );
  }, [rootClass]);
}

export function TokensSection() {
  const values = useTokenValues();

  return (
    <PreviewSection
      id="tokens"
      description="Every token in styles/theme.css, with the value it resolves to in the current theme."
    >
      <Specimen
        label="Colors"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {COLOR_TOKENS.map((name) => (
          <div
            key={name}
            className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-2"
          >
            <span
              aria-hidden
              className="size-10 shrink-0 rounded-md border border-border"
              style={{ background: `var(--${name})` }}
            />
            <span className="grid min-w-0">
              <code className="truncate font-mono text-xs text-foreground">
                --{name}
              </code>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {values[name] || '-'}
              </span>
            </span>
          </div>
        ))}
      </Specimen>

      <Specimen
        label="Backgrounds with their -foreground"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {PAIRED.map((name) => (
          <div
            key={name}
            className="rounded-lg border border-border px-3 py-4 text-sm font-medium"
            style={{
              background: `var(--${name})`,
              color: `var(--${name}-foreground)`,
            }}
          >
            {name} / {name}-foreground
          </div>
        ))}
      </Specimen>

      <Specimen
        label="Tints at /15 with text on them"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        {TINTS.map((tint) => (
          <div
            key={tint.name}
            className={`rounded-lg px-3 py-4 text-sm font-medium ${tint.className}`}
          >
            bg-{tint.name}/15 text-{tint.name}
          </div>
        ))}
      </Specimen>

      <Specimen label={`Radius, --radius is ${values.radius || '-'}`}>
        {RADII.map((radius) => (
          <div
            key={radius}
            className={`flex size-24 items-end border border-border bg-muted p-2 font-mono text-xs text-muted-foreground ${radius}`}
          >
            {radius}
          </div>
        ))}
      </Specimen>

      <Specimen label="Font stacks" className="grid gap-3">
        {FONTS.map((font) => (
          <div
            key={font.name}
            className="grid gap-1 rounded-lg border border-border p-3"
          >
            <p className={`text-lg ${font.className}`}>
              The quick brown fox jumps over the lazy dog 0123456789
            </p>
            <code className="font-mono text-xs break-words text-muted-foreground">
              --{font.name}: {values[font.name] || '-'}
            </code>
          </div>
        ))}
      </Specimen>
    </PreviewSection>
  );
}
