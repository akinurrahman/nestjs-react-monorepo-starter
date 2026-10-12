import type { z } from 'zod';
import { AsyncSelectField } from './fields/async-select-field';
import { ChoiceField } from './fields/choice-field';
import { DateField } from './fields/date-field';
import { InputField } from './fields/input-field';
import { SelectField } from './fields/select-field';
import { SwitchField } from './fields/switch-field';
import { TagsField } from './fields/tags-field';
import { TextareaField } from './fields/textarea-field';
import { TimeField } from './fields/time-field';
import type { FormSchema } from './form';

/**
 * The field components, with `name` and `dependsOn` typed to the schema's
 * keys, so a renamed or misspelled field fails the typecheck instead of
 * rendering an input nothing reads. Call it once at module level, next to
 * the schema. The schema is only read for its type.
 */
export function formFields<S extends FormSchema>(_schema: S) {
  type T = z.input<S>;
  return {
    Input: InputField<T>,
    Textarea: TextareaField<T>,
    Select: SelectField<T>,
    AsyncSelect: AsyncSelectField<T>,
    Choice: ChoiceField<T>,
    Switch: SwitchField<T>,
    Tags: TagsField<T>,
    Time: TimeField<T>,
    Date: DateField<T>,
  };
}
