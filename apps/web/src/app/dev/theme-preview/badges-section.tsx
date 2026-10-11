import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/lib/lookup/create-lookup';
import { LookupBadge } from '@/systems/ui';
import { PreviewSection, Specimen } from './preview-layout';
import { previewStatusLookup } from './preview-data';

const VARIANTS: BadgeVariant[] = [
  'default',
  'secondary',
  'outline',
  'success',
  'warning',
  'info',
  'destructive',
];

export function BadgesSection() {
  return (
    <PreviewSection
      id="badges"
      description="Badge variants, then LookupBadge on a sample createLookup with one entry per variant."
    >
      <Specimen label="Badge">
        {VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </Specimen>
      <Specimen label="Badge with icon">
        {VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            <Star />
            {variant}
          </Badge>
        ))}
      </Specimen>
      <Specimen label="LookupBadge">
        {previewStatusLookup.values.map((value) => (
          <LookupBadge key={value} lookup={previewStatusLookup} value={value} />
        ))}
      </Specimen>
      <Specimen label="LookupBadge without icon">
        {previewStatusLookup.values.map((value) => (
          <LookupBadge
            key={value}
            lookup={previewStatusLookup}
            value={value}
            showIcon={false}
          />
        ))}
      </Specimen>
    </PreviewSection>
  );
}
