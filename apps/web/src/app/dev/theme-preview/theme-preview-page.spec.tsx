import { screen, within } from '@testing-library/react';
import { renderApp } from '@/test/render-app';
import { devRoutes } from '../dev-routes';
import { PREVIEW_SECTIONS } from './preview-sections';

// The page is large, and with the whole suite running in parallel its first
// transform alone can pass the default timeouts.
const SLOW_MS = 20_000;

describe('ThemePreviewPage', { timeout: SLOW_MS }, () => {
  beforeAll(() => import('./theme-preview-page'), SLOW_MS);
  afterEach(() => vi.restoreAllMocks());

  it('renders every section heading without errors', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const consoleWarn = vi.spyOn(console, 'warn');
    renderApp(devRoutes, '/dev/theme');

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Theme preview' },
        { timeout: SLOW_MS },
      ),
    ).toBeInTheDocument();
    PREVIEW_SECTIONS.forEach(({ title }) => {
      expect(
        screen.getByRole('heading', { level: 2, name: title }),
      ).toBeInTheDocument();
    });
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('links each section from the jump list', async () => {
    renderApp(devRoutes, '/dev/theme');

    const jumpList = await screen.findByRole(
      'navigation',
      { name: 'Sections' },
      { timeout: SLOW_MS },
    );
    PREVIEW_SECTIONS.forEach(({ id, title }) => {
      expect(
        within(jumpList).getByRole('link', { name: title }),
      ).toHaveAttribute('href', `#${id}`);
      expect(document.getElementById(id)).toHaveAccessibleName(title);
    });
  });

  it('is listed under Dev in the sidebar', async () => {
    renderApp(devRoutes, '/dev/theme');

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('Dev')).toBeInTheDocument();
    expect(
      within(nav).getByRole('link', { name: 'Theme preview' }),
    ).toHaveAttribute('href', '/dev/theme');
  });
});
