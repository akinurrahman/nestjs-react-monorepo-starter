import { useFieldLabels } from '../form-context';
import { useCascade } from '../hooks/use-cascade';
import { gatedText } from '../lib/cascade';
import type { BaseFieldProps } from '../types';

type FieldShellInput = Omit<BaseFieldProps, 'placeholder'> & {
  placeholder?: string;
};

// What every field does before its own control: the cascade, the FieldShell
// props, and the placeholder and disabled state a gated field shows instead
// of its own. emptyValue is what the cascade writes when a parent changes.
export function useFieldShell(props: FieldShellInput, emptyValue?: unknown) {
  const {
    name,
    label,
    hideLabel,
    description,
    placeholder,
    required,
    disabled,
    className,
    dependsOn,
    alwaysVisible,
  } = props;
  const labelOf = useFieldLabels();
  const { gated, dependsOnList, parentValues } = useCascade({
    name,
    dependsOn,
    emptyValue,
  });

  return {
    shell: {
      name,
      label,
      hideLabel,
      description,
      required,
      className,
      hidden: gated && !alwaysVisible,
    },
    gated,
    parentValues,
    placeholder: gated ? gatedText(dependsOnList.map(labelOf)) : placeholder,
    disabled: Boolean(disabled) || gated,
  };
}
