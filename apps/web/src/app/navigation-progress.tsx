import { useNavigation } from 'react-router';

// Fixed, so it overlays the page instead of pushing it down.
export function ProgressBar() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
      {/* Native progress for assistive tech, the bar below is the visual. */}
      <progress aria-label="Loading page" className="sr-only" />
      <div
        aria-hidden="true"
        className="h-full w-1/4 animate-progress-indeterminate bg-primary motion-reduce:w-full motion-reduce:animate-none"
      />
    </div>
  );
}

// Covers loaders and lazy route chunks alike, since the router waits on both
// before it commits a navigation.
export function NavigationProgress() {
  const navigation = useNavigation();
  return navigation.state === 'idle' ? null : <ProgressBar />;
}
