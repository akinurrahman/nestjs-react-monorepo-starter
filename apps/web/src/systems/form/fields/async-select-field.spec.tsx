import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { peopleSource, servePeople } from '@/test/people-source';
import { renderWithQuery } from '@/test/render-with-query';
import { Form, type FormSchema } from '../form';
import { AsyncSelectField } from './async-select-field';
import { InputField } from './input-field';
import { SelectField } from './select-field';

const LABEL = 'Person';
const DEBOUNCE_MS = 20;

function renderForm(
  field: ReactNode,
  {
    schema = z.object({ person: z.any() }),
    defaultValues,
  }: { schema?: FormSchema; defaultValues?: Record<string, unknown> } = {},
) {
  const onSubmit = vi.fn();
  const result = renderWithQuery(
    <Form schema={schema} defaultValues={defaultValues} onSubmit={onSubmit}>
      {field}
      <button type="submit">Save</button>
    </Form>,
  );
  return { ...result, onSubmit, user: userEvent.setup() };
}

const trigger = (name = LABEL) => screen.getByRole('combobox', { name });
const optionNames = () =>
  screen.queryAllByRole('option').map((option) => option.textContent);

async function openPicker(user: UserEvent, name = LABEL) {
  await user.click(trigger(name));
  return screen.findByRole('listbox');
}

describe.each([
  {
    title: 'single',
    multi: false,
    value: z.string().min(1, 'Pick a person'),
    expected: 'alice',
  },
  {
    title: 'multi',
    multi: true,
    value: z.array(z.string()).min(1, 'Pick a person'),
    expected: ['alice'],
  },
])('AsyncSelectField $title', ({ multi, value, expected }) => {
  const schema = z.object({ person: value, after: z.string().min(1) });
  const fields = (
    <>
      <AsyncSelectField
        name="person"
        label={LABEL}
        source={peopleSource}
        debounceMs={DEBOUNCE_MS}
        multi={multi}
      />
      <InputField name="after" label="After" />
    </>
  );

  it('is named by its label', () => {
    servePeople();
    renderForm(fields, { schema });

    expect(trigger()).toHaveAccessibleName(LABEL);
  });

  it('ends in a chevron that opens the list', async () => {
    servePeople();
    const { user } = renderForm(fields, { schema });
    const host = multi
      ? screen.getByRole('button', { name: 'Show options' })
      : trigger();

    expect(host.querySelector('svg[class*="chevron-down"]')).not.toBeNull();
    await user.click(host);
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });

  it('submits its value', async () => {
    servePeople();
    const { user, onSubmit } = renderForm(fields, { schema });

    await openPicker(user);
    await user.click(await screen.findByRole('option', { name: 'Alice' }));
    await user.keyboard('{Escape}');
    await user.type(screen.getByRole('textbox', { name: 'After' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      person: expected,
      after: 'x',
    });
  });

  it('shows the schema error and marks the control invalid', async () => {
    const { user } = renderForm(fields, { schema });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(trigger()).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(trigger()).toHaveAccessibleDescription('Pick a person');
  });

  it('takes focus as the first invalid field', async () => {
    const { user } = renderForm(fields, { schema });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it('shows the seeded label before any fetch', () => {
    const requests = servePeople();
    renderForm(
      <AsyncSelectField
        name="person"
        label={LABEL}
        source={peopleSource}
        multi={multi}
        initialOptions={[{ value: 'xavier', label: 'Xavier' }]}
      />,
      { defaultValues: { person: multi ? ['xavier'] : 'xavier' } },
    );

    expect(screen.getByText('Xavier')).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('keeps a selected label after a search that excludes it', async () => {
    servePeople();
    const { user } = renderForm(
      <AsyncSelectField
        name="person"
        label={LABEL}
        source={peopleSource}
        debounceMs={DEBOUNCE_MS}
        multi={multi}
      />,
    );

    await openPicker(user);
    await user.click(await screen.findByRole('option', { name: 'Alice' }));
    if (!multi) await openPicker(user);
    await user.keyboard('bob');

    await waitFor(() => expect(optionNames()).toEqual(['Bob']));
    const shown = multi
      ? trigger().closest('[data-slot="combobox-chips"]')!
      : trigger();
    expect(within(shown as HTMLElement).getByText('Alice')).toBeInTheDocument();
  });
});

describe('AsyncSelectField fetching', () => {
  const single = (
    <AsyncSelectField
      name="person"
      label={LABEL}
      source={peopleSource}
      debounceMs={DEBOUNCE_MS}
    />
  );

  it('debounces the search and sends it to the server', async () => {
    const requests = servePeople();
    const { user } = renderForm(single);

    await openPicker(user);
    await waitFor(() => expect(optionNames()).toHaveLength(20));
    await user.keyboard('ali');

    await waitFor(() => expect(optionNames()).toEqual(['Alice']));
    expect(requests.map((params) => params.get('search'))).toEqual([
      null,
      'ali',
    ]);
  });

  it('loads the next page on scroll', async () => {
    const requests = servePeople();
    const { user } = renderForm(single);

    const listbox = await openPicker(user);
    await waitFor(() => expect(optionNames()).toHaveLength(20));
    fireEvent.scroll(listbox);

    await waitFor(() => expect(optionNames()).toHaveLength(33));
    expect(requests.map((params) => params.get('page'))).toEqual(['1', '2']);
  });

  it('shares one request between two pickers on the same source', async () => {
    const requests = servePeople();
    const { user } = renderForm(
      <>
        {single}
        <AsyncSelectField
          name="other"
          label="Other"
          source={peopleSource}
          debounceMs={DEBOUNCE_MS}
        />
      </>,
    );

    await openPicker(user);
    await waitFor(() => expect(optionNames()).toHaveLength(20));
    await user.keyboard('{Escape}');
    await openPicker(user, 'Other');

    await waitFor(() => expect(optionNames()).toHaveLength(20));
    expect(requests).toHaveLength(1);
  });

  it('shows a failed request with a retry, not an empty result', async () => {
    // The first request and both of its retries fail.
    servePeople({ failOn: [1, 2, 3] });
    const { user } = renderForm(single);

    await openPicker(user);

    expect(
      await screen.findByText("Couldn't load options"),
    ).toBeInTheDocument();
    expect(screen.queryByText('No results.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(optionNames()).toHaveLength(20));
    expect(screen.queryByText("Couldn't load options")).not.toBeInTheDocument();
  });

  it('refetches an open picker when the source key is invalidated', async () => {
    const requests = servePeople();
    const { user, client } = renderForm(single);

    await openPicker(user);
    await waitFor(() => expect(optionNames()).toHaveLength(20));
    await act(() =>
      client.invalidateQueries({ queryKey: peopleSource.queryKey }),
    );

    expect(requests).toHaveLength(2);
  });

  it('clears and refetches with the new parent value', async () => {
    const requests = servePeople();
    const { user, onSubmit } = renderForm(
      <>
        <SelectField
          name="team"
          label="Team"
          options={[
            { value: 'red', label: 'Red' },
            { value: 'blue', label: 'Blue' },
          ]}
        />
        <AsyncSelectField
          name="person"
          label={LABEL}
          source={peopleSource}
          debounceMs={DEBOUNCE_MS}
          dependsOn="team"
        />
      </>,
      {
        schema: z.object({ team: z.string(), person: z.string() }),
        defaultValues: { team: 'red' },
      },
    );

    await openPicker(user);
    await user.click(await screen.findByRole('option', { name: 'Alice' }));
    expect(trigger()).toHaveTextContent('Alice');

    await user.click(trigger('Team'));
    await user.click(await screen.findByRole('option', { name: 'Blue' }));

    expect(trigger()).not.toHaveTextContent('Alice');
    await openPicker(user);
    await waitFor(() => expect(optionNames()).toEqual(['Carol']));
    expect(requests.map((params) => params.get('team'))).toEqual([
      'red',
      'blue',
    ]);

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual({ team: 'blue', person: '' });
  });
});
