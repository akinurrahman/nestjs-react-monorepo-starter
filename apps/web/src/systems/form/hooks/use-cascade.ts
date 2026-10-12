import { useEffect, useEffectEvent } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { isEmptyValue } from '@/lib/is-empty-value';
import { normalizeDependsOn } from '../lib/cascade';

type Options = {
  name: string;
  dependsOn?: string | string[];
  // Written to this field when a parent changes: '' for a single select, []
  // for a multi, undefined for a number.
  emptyValue?: unknown;
};

type Result = {
  parentValues: Record<string, unknown>;
  dependsOnList: string[];
  gated: boolean;
};

/**
 * Clears this field when a parent changes, and reports whether any parent is
 * still empty.
 *
 * The clear reacts to change events, not to the parent's value moving. A user
 * edit and a setValue both name the field they changed, so they cascade. A
 * reset names nothing, so reset(record) keeps the record's child value instead
 * of wiping it. Nothing is written on mount either, which is what keeps edit
 * defaults intact through StrictMode's double mount.
 */
export function useCascade({
  name,
  dependsOn,
  emptyValue = '',
}: Options): Result {
  const { control, subscribe, setValue } = useFormContext();
  const dependsOnList = normalizeDependsOn(dependsOn);
  const parentsKey = dependsOnList.join('\n');

  const watched = useWatch({
    control,
    name: dependsOnList,
    disabled: dependsOnList.length === 0,
  }) as unknown[];

  // An effect event, because callers pass a fresh [] every render and that
  // would otherwise resubscribe on each one.
  const clear = useEffectEvent(() => {
    setValue(name, emptyValue, { shouldDirty: true });
  });

  useEffect(() => {
    const parents = parentsKey ? parentsKey.split('\n') : [];
    if (!parents.length) return;

    return subscribe({
      name: parents,
      formState: { values: true },
      callback: (state) => {
        if (!state.name || !parents.includes(state.name)) return;
        clear();
      },
    });
  }, [subscribe, parentsKey]);

  const parentValues: Record<string, unknown> = {};
  dependsOnList.forEach((parent, index) => {
    parentValues[parent] = watched[index];
  });

  return {
    parentValues,
    dependsOnList,
    gated: dependsOnList.some((_, index) => isEmptyValue(watched[index])),
  };
}
