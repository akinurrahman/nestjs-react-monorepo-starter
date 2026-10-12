import { ERROR_CODES } from '@starter/shared';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import {
  AsyncSelectField,
  ChoiceField,
  DateField,
  Form,
  FormActions,
  FormError,
  InputField,
  SelectField,
  SwitchField,
  TagsField,
  TextareaField,
  TimeField,
} from '@/systems/form';
import { PreviewSection, PreviewSwitch } from './preview-layout';
import { DEPARTMENTS, PEOPLE, peopleSource } from './preview-data';

const SKILLS = [
  { value: 'react', label: 'React' },
  { value: 'node', label: 'Node' },
  { value: 'sql', label: 'SQL' },
  { value: 'design', label: 'Design systems' },
  { value: 'writing', label: 'Writing' },
];

const CONTRACTS = [
  {
    value: 'permanent',
    label: 'Permanent',
    description: 'Salaried, with notice period and benefits.',
  },
  {
    value: 'fixed',
    label: 'Fixed term',
    description: 'Ends on a set date unless renewed.',
  },
];

const schema = z.object({
  name: z.string().min(1, 'Enter a name'),
  email: z.email('Enter a valid email'),
  age: z.number({ error: 'Enter an age' }).int().min(18, 'Must be 18 or older'),
  password: z.string().min(8, 'Use 8 characters or more'),
  bio: z.string().min(1, 'Write a short bio'),
  department: z.string().min(1, 'Pick a department'),
  skills: z.array(z.string()).min(1, 'Pick at least one skill'),
  contract: z.string().min(1, 'Choose a contract'),
  remote: z.boolean().refine((on) => on, 'Turn this on to continue'),
  tags: z.array(z.string()).min(1, 'Add a tag'),
  startTime: z.string().min(1, 'Enter a start time'),
  startDate: z.string().min(1, 'Pick a start date'),
  manager: z.string().min(1, 'Pick a manager'),
  mentors: z.array(z.string()).min(1, 'Pick at least one mentor'),
});

type Values = z.input<typeof schema>;

const FIELD_NAMES = Object.keys(schema.shape);

const DEFAULTS: Partial<Values> = { remote: false };

const SAMPLE: Values = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  age: 36,
  password: 'analytical engine',
  bio: 'Wrote the first published program, for a machine that was never built.',
  department: PEOPLE[0]!.department,
  skills: ['react', 'writing'],
  contract: 'permanent',
  remote: true,
  tags: ['mentor', 'on call'],
  startTime: '09:30',
  startDate: '2026-11-02',
  manager: PEOPLE[0]!.id,
  mentors: [PEOPLE[1]!.id, PEOPLE[2]!.id],
};

const INITIAL_PEOPLE = PEOPLE.slice(0, 3).map((person) => ({
  value: person.id,
  label: person.name,
}));

// What a 400 with field errors looks like once apiCall has turned it into an
// ApiError. onSubmit throws it, so Form maps it exactly as it would a
// feature's rejected mutation. The last path names no field, so it lands in
// FormError.
const SERVER_ERROR = new ApiError({
  status: 400,
  code: ERROR_CODES.VALIDATION_FAILED,
  message: 'The server rejected some of these values',
  fieldErrors: [
    ...FIELD_NAMES.map((path) => ({
      path,
      message: `The server rejected ${path}`,
      code: 'custom',
    })),
    { path: 'legacyId', message: 'Legacy id taken', code: 'custom' },
  ],
});

const SUBMIT_DELAY_MS = 800;

export function FormSection() {
  const [disabled, setDisabled] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const rejectNext = useRef(false);

  async function submit(values: z.output<typeof schema>) {
    setIsPending(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, SUBMIT_DELAY_MS));
      if (rejectNext.current) {
        rejectNext.current = false;
        throw SERVER_ERROR;
      }
      toast.success('Form submitted', {
        description: `${values.name}, ${values.email}`,
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <PreviewSection
      id="form"
      description="Every field in systems/form, all required, inside a real Form. Submit empty for client errors. Show server errors fills the sample values and submits, and onSubmit throws the ApiError a 400 would, so Form maps it as it does for a feature."
    >
      <PreviewSwitch
        label="Disable every field"
        checked={disabled}
        onCheckedChange={setDisabled}
      />

      <Form
        schema={schema}
        defaultValues={DEFAULTS}
        onSubmit={submit}
        className="grid gap-5"
      >
        {(form) => (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <InputField
                name="name"
                label="Name"
                description="InputField, text."
                placeholder="Ada Lovelace"
                required
                disabled={disabled}
              />
              <InputField
                name="email"
                label="Email"
                type="email"
                description="InputField, email."
                placeholder="ada@example.com"
                autoComplete="off"
                required
                disabled={disabled}
              />
              <InputField
                name="age"
                label="Age"
                type="number"
                min={0}
                description="InputField, number. Empty is undefined, not 0."
                required
                disabled={disabled}
              />
              <InputField
                name="password"
                label="Password"
                type="password"
                autoComplete="new-password"
                description="InputField, password, with the reveal toggle."
                required
                disabled={disabled}
              />
              <TextareaField
                name="bio"
                label="Bio"
                description="TextareaField."
                placeholder="A line or two"
                rows={3}
                required
                disabled={disabled}
                className="md:col-span-2"
              />
              <SelectField
                name="department"
                label="Department"
                description="SelectField."
                options={DEPARTMENTS}
                required
                disabled={disabled}
              />
              <SelectField
                name="skills"
                label="Skills"
                description="SelectField, multi."
                options={SKILLS}
                multi
                required
                disabled={disabled}
              />
              <AsyncSelectField
                name="manager"
                label="Manager"
                description="AsyncSelectField, depends on Department. Scroll the list to load more."
                source={peopleSource}
                initialOptions={INITIAL_PEOPLE}
                dependsOn="department"
                alwaysVisible
                required
                disabled={disabled}
              />
              <AsyncSelectField
                name="mentors"
                label="Mentors"
                description="AsyncSelectField, multi, over every person."
                source={peopleSource}
                initialOptions={INITIAL_PEOPLE}
                multi
                required
                disabled={disabled}
              />
              <ChoiceField
                name="contract"
                label="Contract"
                description="ChoiceField."
                options={CONTRACTS}
                required
                disabled={disabled}
                className="md:col-span-2"
              />
              <TagsField
                name="tags"
                label="Tags"
                description="TagsField, at most 4."
                maxItems={4}
                required
                disabled={disabled}
              />
              <TimeField
                name="startTime"
                label="Start time"
                description="TimeField."
                required
                disabled={disabled}
              />
              <DateField
                name="startDate"
                label="Start date"
                description="DateField, 2026 only."
                min="2026-01-01"
                max="2026-12-31"
                required
                disabled={disabled}
              />
              <SwitchField
                name="remote"
                label="Remote"
                description="SwitchField."
                required
                disabled={disabled}
              />
            </div>

            <FormError />

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {/* A submit, so the error takes the real path: the sample
                  values pass client validation, then onSubmit throws. */}
              <Button
                type="submit"
                variant="outline"
                onClick={() => {
                  rejectNext.current = true;
                  form.reset(SAMPLE);
                }}
              >
                Show server errors
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset(SAMPLE)}
              >
                Fill sample values
              </Button>
              <FormActions
                submitLabel="Submit"
                pendingLabel="Submitting"
                cancelLabel="Reset"
                isPending={isPending}
                onCancel={() => form.reset()}
                className="sm:ml-auto"
              />
            </div>
          </>
        )}
      </Form>
    </PreviewSection>
  );
}
