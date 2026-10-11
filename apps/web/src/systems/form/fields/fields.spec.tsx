import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { Form, type FormSchema } from '../form';
import type { Option } from '../types';
import { ChoiceField } from './choice-field';
import { DateField } from './date-field';
import { InputField } from './input-field';
import { SelectField } from './select-field';
import { SwitchField } from './switch-field';
import { TagsField } from './tags-field';
import { TextareaField } from './textarea-field';
import { TimeField } from './time-field';

const OPTIONS: Option[] = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
];

const LABEL = 'Value';

type FieldCase = {
  title: string;
  value: z.ZodType;
  defaultValue?: unknown;
  field: ReactNode;
  // The element that carries the accessible name and aria-invalid.
  control: () => HTMLElement;
  // The element focus lands on, when it is not the control itself.
  focusTarget?: () => HTMLElement;
  fill: (user: UserEvent) => Promise<void>;
  expected: unknown;
  error: string;
};

const byLabel = () => screen.getByLabelText(LABEL, { selector: 'input' });

const CASES: FieldCase[] = [
  {
    title: 'InputField',
    value: z.string().min(1, 'Enter a value'),
    field: <InputField name="value" label={LABEL} />,
    control: () => screen.getByRole('textbox', { name: LABEL }),
    fill: (user) =>
      user.type(screen.getByRole('textbox', { name: LABEL }), 'Ada'),
    expected: 'Ada',
    error: 'Enter a value',
  },
  {
    title: 'InputField number',
    value: z.number({ error: 'Enter a number' }),
    field: <InputField name="value" label={LABEL} type="number" />,
    control: () => screen.getByRole('spinbutton', { name: LABEL }),
    fill: (user) => user.type(screen.getByRole('spinbutton'), '42'),
    expected: 42,
    error: 'Enter a number',
  },
  {
    title: 'InputField password',
    value: z.string().min(8, 'Use 8 characters or more'),
    field: <InputField name="value" label={LABEL} type="password" />,
    control: byLabel,
    fill: (user) => user.type(byLabel(), 'correct horse'),
    expected: 'correct horse',
    error: 'Use 8 characters or more',
  },
  {
    title: 'TextareaField',
    value: z.string().min(1, 'Write something'),
    field: <TextareaField name="value" label={LABEL} />,
    control: () => screen.getByRole('textbox', { name: LABEL }),
    fill: (user) =>
      user.type(screen.getByRole('textbox', { name: LABEL }), 'Hello'),
    expected: 'Hello',
    error: 'Write something',
  },
  {
    title: 'SelectField',
    value: z.string().min(1, 'Pick one'),
    field: <SelectField name="value" label={LABEL} options={OPTIONS} />,
    control: () => screen.getByRole('combobox', { name: LABEL }),
    fill: async (user) => {
      await user.click(screen.getByRole('combobox', { name: LABEL }));
      await user.click(await screen.findByRole('option', { name: 'Beta' }));
    },
    expected: 'beta',
    error: 'Pick one',
  },
  {
    title: 'SelectField multi',
    value: z.array(z.string()).min(1, 'Pick at least one'),
    field: <SelectField name="value" label={LABEL} options={OPTIONS} multi />,
    control: () => screen.getByRole('combobox', { name: LABEL }),
    fill: async (user) => {
      await user.click(screen.getByRole('combobox', { name: LABEL }));
      await user.click(await screen.findByRole('option', { name: 'Alpha' }));
      await user.click(await screen.findByRole('option', { name: 'Beta' }));
      await user.keyboard('{Escape}');
    },
    expected: ['alpha', 'beta'],
    error: 'Pick at least one',
  },
  {
    title: 'ChoiceField',
    value: z.string().min(1, 'Choose one'),
    field: <ChoiceField name="value" label={LABEL} options={OPTIONS} />,
    control: () => screen.getByRole('radiogroup', { name: LABEL }),
    focusTarget: () => screen.getByRole('radio', { name: 'Alpha' }),
    fill: (user) => user.click(screen.getByRole('radio', { name: 'Beta' })),
    expected: 'beta',
    error: 'Choose one',
  },
  {
    title: 'SwitchField',
    value: z.boolean().refine((on) => on, 'Turn it on'),
    defaultValue: false,
    field: <SwitchField name="value" label={LABEL} />,
    control: () => screen.getByRole('switch', { name: LABEL }),
    fill: (user) => user.click(screen.getByRole('switch')),
    expected: true,
    error: 'Turn it on',
  },
  {
    title: 'TagsField',
    value: z.array(z.string()).min(1, 'Add a tag'),
    field: <TagsField name="value" label={LABEL} />,
    control: () => screen.getByRole('textbox', { name: LABEL }),
    fill: (user) =>
      user.type(screen.getByRole('textbox', { name: LABEL }), 'one{Enter}two,'),
    expected: ['one', 'two'],
    error: 'Add a tag',
  },
  {
    title: 'TimeField',
    value: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a time like 09:00'),
    field: <TimeField name="value" label={LABEL} />,
    control: byLabel,
    fill: (user) => user.type(byLabel(), '09:30'),
    expected: '09:30',
    error: 'Enter a time like 09:00',
  },
  {
    title: 'DateField',
    value: z.string().min(1, 'Pick a date'),
    field: <DateField name="value" label={LABEL} />,
    control: () => screen.getByRole('button', { name: LABEL }),
    fill: async (user) => {
      await user.click(screen.getByRole('button', { name: LABEL }));
      await user.click(
        await screen.findByRole('button', { name: /October 15th, 2026/ }),
      );
    },
    expected: '2026-10-15',
    error: 'Pick a date',
  },
];

function renderCase(
  { value, defaultValue, field }: FieldCase,
  onSubmit: (values: Record<string, unknown>) => void = vi.fn(),
) {
  const schema = z.object({
    value,
    after: z.string().min(1, 'Fill this too'),
  });
  render(
    <Form
      schema={schema}
      defaultValues={
        defaultValue === undefined ? undefined : { value: defaultValue }
      }
      onSubmit={onSubmit}
    >
      {field}
      <InputField name="after" label="After" />
      <button type="submit">Save</button>
    </Form>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 10, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

describe.each(CASES)('$title', (testCase) => {
  it('is named by its label', () => {
    renderCase(testCase);

    expect(testCase.control()).toHaveAccessibleName(LABEL);
  });

  it('submits its value', async () => {
    const onSubmit = vi.fn();
    const user = renderCase(testCase, onSubmit);

    await testCase.fill(user);
    await user.type(screen.getByRole('textbox', { name: 'After' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      value: testCase.expected,
      after: 'x',
    });
  });

  it('shows the schema error and marks the control invalid', async () => {
    const user = renderCase(testCase);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const control = testCase.control();
    await waitFor(() =>
      expect(control).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(control).toHaveAccessibleDescription(testCase.error);
  });

  it('takes focus as the first invalid field', async () => {
    const user = renderCase(testCase);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const target = (testCase.focusTarget ?? testCase.control)();
    await waitFor(() => expect(target).toHaveFocus());
  });
});

function renderAlone(
  field: ReactNode,
  schema: FormSchema = z.object({ value: z.any() }),
) {
  const onSubmit = vi.fn();
  render(
    <Form schema={schema} onSubmit={onSubmit}>
      {field}
      <button type="submit">Save</button>
    </Form>,
  );
  return { user: userEvent.setup(), onSubmit };
}

describe('FieldShell', () => {
  it('keeps a hidden label as the accessible name', () => {
    renderAlone(<InputField name="value" label="Search" hideLabel />);

    expect(screen.getByText('Search')).toHaveClass('sr-only');
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeVisible();
  });

  it('points aria-describedby only at text that renders', async () => {
    const { user } = renderAlone(
      <>
        <InputField name="value" label="Bare" />
        <InputField name="other" label="Described" description="Shown" />
      </>,
      z.object({ value: z.string(), other: z.string().min(1, 'Needed') }),
    );

    expect(screen.getByRole('textbox', { name: 'Bare' })).not.toHaveAttribute(
      'aria-describedby',
    );
    const described = screen.getByRole('textbox', { name: 'Described' });
    expect(described).toHaveAccessibleDescription('Shown');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(described).toHaveAccessibleDescription('Shown Needed'),
    );
  });
});

describe('InputField password', () => {
  it('reveals and hides the value', async () => {
    const { user } = renderAlone(
      <InputField name="value" label="Password" type="password" />,
    );
    const input = screen.getByLabelText('Password', { selector: 'input' });

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});

describe('SelectField chevron', () => {
  it.each([
    { title: 'single', multi: false },
    { title: 'multi', multi: true },
  ])('$title ends in a chevron that opens the list', async ({ multi }) => {
    const { user } = renderAlone(
      <SelectField name="value" label="Pick" options={OPTIONS} multi={multi} />,
    );
    const host = multi
      ? screen.getByRole('button', { name: 'Show options' })
      : screen.getByRole('combobox', { name: 'Pick' });

    expect(host.querySelector('svg[class*="chevron-down"]')).not.toBeNull();
    await user.click(host);
    expect(
      await screen.findByRole('option', { name: 'Alpha' }),
    ).toBeInTheDocument();
  });

  it('keeps the multi chevron out of the tab order', () => {
    renderAlone(
      <SelectField name="value" label="Pick" options={OPTIONS} multi />,
    );

    expect(
      screen.getByRole('button', { name: 'Show options' }),
    ).toHaveAttribute('tabindex', '-1');
  });
});

describe('SelectField optionsFn', () => {
  it('derives its options from live form values', async () => {
    const { user } = renderAlone(
      <>
        <InputField name="prefix" label="Prefix" />
        <SelectField
          name="value"
          label="Code"
          optionsFn={(values) => [
            { value: 'x', label: `${String(values.prefix)}-x` },
          ]}
        />
      </>,
      z.object({ prefix: z.string(), value: z.string() }),
    );

    await user.type(screen.getByRole('textbox', { name: 'Prefix' }), 'AB');
    await user.click(screen.getByRole('combobox', { name: 'Code' }));

    expect(
      await screen.findByRole('option', { name: 'AB-x' }),
    ).toBeInTheDocument();
  });
});

describe('TagsField maxItems', () => {
  it('blocks typing when full but still removes with Backspace and the button', async () => {
    const { user, onSubmit } = renderAlone(
      <TagsField name="value" label="Tags" maxItems={2} />,
      z.object({ value: z.array(z.string()) }),
    );
    const input = screen.getByRole('textbox', { name: 'Tags' });

    await user.type(input, 'one{Enter}two{Enter}three');
    expect(input).toHaveValue('');
    expect(screen.queryByText('three')).toBeNull();

    await user.type(input, '{Backspace}');
    expect(screen.queryByRole('button', { name: 'Remove two' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Remove one' }));
    await user.type(input, 'four{Enter}');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual({ value: ['four'] });
  });
});

describe('DateField bounds', () => {
  it('disables days outside min and max', async () => {
    const { user } = renderAlone(
      <DateField name="value" label="Day" min="2026-10-05" max="2026-10-20" />,
    );

    await user.click(screen.getByRole('button', { name: 'Day' }));

    expect(
      await screen.findByRole('button', { name: /October 4th, 2026/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /October 21st, 2026/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /October 12th, 2026/ }),
    ).toBeEnabled();
  });

  it('shows the picked day through formatDate', async () => {
    const { user } = renderAlone(<DateField name="value" label="Day" />);

    await user.click(screen.getByRole('button', { name: 'Day' }));
    await user.click(
      await screen.findByRole('button', { name: /October 15th, 2026/ }),
    );

    expect(screen.getByRole('button', { name: 'Day' })).toHaveTextContent(
      '15 Oct 2026',
    );
  });
});
