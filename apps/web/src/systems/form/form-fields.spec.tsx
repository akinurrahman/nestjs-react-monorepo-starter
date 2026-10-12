import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Form } from './form';
import { formFields } from './form-fields';

const schema = z.object({
  department: z.string(),
  manager: z.string(),
});

const Field = formFields(schema);

describe('formFields', () => {
  it('renders the field it returns', () => {
    render(
      <Form schema={schema} onSubmit={() => {}}>
        <Field.Input name="department" label="Department" />
      </Form>,
    );

    expect(screen.getByLabelText('Department')).toBeInTheDocument();
  });

  // Never rendered: the typecheck is the test. An unused @ts-expect-error
  // fails tsc, so these break if a name stops being checked.
  it('rejects a name or dependsOn the schema does not have', () => {
    const typeOnly = () => (
      <>
        {/* @ts-expect-error: not a key of the schema */}
        <Field.Input name="departmnet" label="Department" />
        <Field.Select
          name="manager"
          label="Manager"
          options={[]}
          // @ts-expect-error: not a key of the schema
          dependsOn="departmnet"
        />
        <Field.Select
          name="manager"
          label="Manager"
          options={[]}
          // @ts-expect-error: not a key of the schema
          dependsOn={['department', 'departmnet']}
        />
        <Field.Select
          name="manager"
          label="Manager"
          options={[]}
          dependsOn="department"
        />
      </>
    );

    expect(typeOnly).toBeTypeOf('function');
  });
});
