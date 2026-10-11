// Every new piece in components/ui or systems gets a section here, or a
// specimen in an existing one, in the same change that adds it. This page is
// what the /theme skill shows, so anything missing from it goes unreviewed.
import { PageHeader } from '@/systems/ui';
import { BadgesSection } from './badges-section';
import { ButtonsSection } from './buttons-section';
import { ErrorsSection } from './errors-section';
import { FiltersSection } from './filters-section';
import { FormSection } from './form-section';
import { OverlaysSection } from './overlays-section';
import { PREVIEW_SECTIONS } from './preview-sections';
import { StatesSection } from './states-section';
import { TableSection } from './table-section';
import { ToastsSection } from './toasts-section';
import { TokensSection } from './tokens-section';

export default function ThemePreviewPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Theme preview"
        description="Dev only. Every token and shared component, in whichever theme the header toggle picks. Fake data, no API calls."
        className="pb-0"
      />

      <nav aria-label="Sections">
        <ul className="flex flex-wrap gap-2">
          {PREVIEW_SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <TokensSection />
      <ButtonsSection />
      <BadgesSection />
      <FormSection />
      <FiltersSection />
      <TableSection />
      <StatesSection />
      <OverlaysSection />
      <ToastsSection />
      <ErrorsSection />
    </div>
  );
}
