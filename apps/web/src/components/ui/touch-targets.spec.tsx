import { render, screen, within } from '@testing-library/react';
import { buttonVariants } from './button';
import { Calendar } from './calendar';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from './combobox';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Input } from './input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from './select';
import { Sheet, SheetContent, SheetTitle } from './sheet';

// The rule from CLAUDE.md: 40px below sm, 32 to 36px from sm up. jsdom has
// no layout, so these check the classes that carry it.
const BELOW_SM = /(^|\s)(h|size|min-h)-10(\s|$)/;
const FROM_SM = /(^|\s)sm:(h|size|min-h)-(8|9)(\s|$)/;

function expectTouchSized(className: string) {
  expect(className).toMatch(BELOW_SM);
  expect(className).toMatch(FROM_SM);
}

describe('touch targets', () => {
  it.each([
    'default',
    'xs',
    'sm',
    'lg',
    'icon',
    'icon-xs',
    'icon-sm',
    'icon-lg',
  ] as const)('button size %s', (size) => {
    expectTouchSized(buttonVariants({ size }));
  });

  it('lines a default button up with an input and a select', () => {
    render(
      <>
        <Input aria-label="Name" />
        <Select items={[]}>
          <SelectTrigger aria-label="Status" />
        </Select>
      </>,
    );

    expect(buttonVariants()).toMatch(/(^|\s)h-10(\s|$)/);
    expect(buttonVariants()).toMatch(/(^|\s)sm:h-9(\s|$)/);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveClass(
      'h-10',
      'sm:h-9',
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveClass(
      'data-[size=default]:h-10',
      'sm:data-[size=default]:h-9',
    );
  });

  it('menu items of every kind', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Plain</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Checkbox</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Radio</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const menu = screen.getByRole('menu');
    [
      within(menu).getByRole('menuitem', { name: 'Plain' }),
      within(menu).getByRole('menuitemcheckbox', { name: 'Checkbox' }),
      within(menu).getByRole('menuitemradio', { name: 'Radio' }),
      within(menu).getByRole('menuitem', { name: 'More' }),
    ].forEach((item) => expectTouchSized(item.className));
  });

  it('select items', () => {
    render(
      <Select defaultOpen items={[{ value: 'a', label: 'Alpha' }]}>
        <SelectTrigger aria-label="Pick" />
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );

    expectTouchSized(screen.getByRole('option', { name: 'Alpha' }).className);
  });

  it('combobox items, and the chip remove hit area', () => {
    render(
      <Combobox multiple defaultOpen items={['alpha']} defaultValue={['alpha']}>
        <ComboboxChips>
          <ComboboxValue>
            {(values: string[]) =>
              values.map((value) => (
                <ComboboxChip key={value}>{value}</ComboboxChip>
              ))
            }
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>,
    );

    expectTouchSized(screen.getByRole('option', { name: 'alpha' }).className);
    const remove = document.querySelector('[data-slot="combobox-chip-remove"]');
    // 24px plus 8px above and below, and 12px left plus 4px right, is 40px.
    // From sm, 4px and 6px plus 2px make 32px.
    expect(remove).toHaveClass(
      'relative',
      'size-6',
      'after:-inset-y-2',
      'after:-left-3',
      'after:-right-1',
      'sm:after:-inset-y-1',
      'sm:after:-left-1.5',
      'sm:after:-right-0.5',
    );
  });

  it.each([
    [
      'dialog',
      <Dialog key="dialog" open>
        <DialogContent>
          <DialogTitle>Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    ],
    [
      'sheet',
      <Sheet key="sheet" open>
        <SheetContent>
          <SheetTitle>Sheet</SheetTitle>
        </SheetContent>
      </Sheet>,
    ],
  ])('the %s close button', (_, ui) => {
    render(ui);

    const close = screen.getByRole('button', { name: 'Close' });
    expectTouchSized(close.className);
    expect(close).not.toHaveClass('sm:size-7');
  });

  it('calendar day cells', () => {
    render(<Calendar mode="single" />);

    expect(document.querySelector('[data-slot="calendar"]')).toHaveClass(
      '[--cell-size:--spacing(10)]',
      'sm:[--cell-size:--spacing(8)]',
    );
  });
});
