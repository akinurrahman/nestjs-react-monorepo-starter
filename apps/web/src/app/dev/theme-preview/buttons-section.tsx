import { ArrowRight, Plus, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PreviewSection, Specimen } from './preview-layout';

const VARIANTS = [
  'default',
  'outline',
  'secondary',
  'ghost',
  'destructive',
  'link',
] as const;

const SIZES = ['xs', 'sm', 'default'] as const;

const ICON_SIZES = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const;

export function ButtonsSection() {
  return (
    <PreviewSection
      id="buttons"
      description="Every variant at every size, with icons, and disabled."
    >
      {VARIANTS.map((variant) => (
        <Specimen key={variant} label={variant}>
          {SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              {size}
            </Button>
          ))}
          <Button variant={variant}>
            <Plus data-icon="inline-start" />
            Icon start
          </Button>
          <Button variant={variant}>
            Icon end
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
          {ICON_SIZES.map((size) => (
            <Button
              key={size}
              variant={variant}
              size={size}
              aria-label={`Settings, ${variant} ${size}`}
            >
              <Settings />
            </Button>
          ))}
          <Button
            variant={variant}
            size="icon"
            disabled
            aria-label={`Delete, ${variant} disabled`}
          >
            <Trash2 />
          </Button>
        </Specimen>
      ))}
    </PreviewSection>
  );
}
