import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { FieldError } from '@starter/shared';
import { getErrorMessage, isApiError } from '@/lib/api/api-error';

export const ROOT_ERROR = 'root.server';

/**
 * Puts a rejected submit back on the form. A field error lands on the nearest
 * field on screen: its full path, else the path with trailing segments
 * dropped, so `role.0` lands on `role`. The first field marked takes focus,
 * and a field marked twice keeps the first message. Anything the person
 * cannot see next to a control, unknown paths and `''` included, becomes one
 * root message, so nothing is silently dropped.
 */
export function applyServerError<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  fieldNames: ReadonlySet<string>,
): void {
  const fieldErrors = isApiError(error) ? error.fieldErrors : [];
  const onScreen = new Map<string, FieldError>();
  let offScreen = 0;

  for (const fieldError of fieldErrors) {
    const name = nearestField(fieldError.path, fieldNames);
    if (name === undefined) offScreen += 1;
    else if (!onScreen.has(name)) onScreen.set(name, fieldError);
  }

  [...onScreen].forEach(([name, { message }], index) => {
    setError(
      name as Path<T>,
      { type: 'server', message },
      { shouldFocus: index === 0 },
    );
  });

  if (onScreen.size === 0 || offScreen > 0) {
    setError(ROOT_ERROR, { type: 'server', message: getErrorMessage(error) });
  }
}

function nearestField(
  path: string,
  fieldNames: ReadonlySet<string>,
): string | undefined {
  const segments = path.split('.');
  while (segments.length > 0) {
    const candidate = segments.join('.');
    if (fieldNames.has(candidate)) return candidate;
    segments.pop();
  }
  return undefined;
}
