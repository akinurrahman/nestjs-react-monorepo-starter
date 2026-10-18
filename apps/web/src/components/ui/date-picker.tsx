import { lazy, Suspense, useState, type Ref } from 'react';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  calendarDateOf,
  formatDate,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/date';
import { cn } from '@/lib/utils';

type DatePickerProps = {
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  ref?: Ref<HTMLButtonElement>;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  className?: string;
};

// react-day-picker is most of the form code, and every form imports this
// through the field barrel, the login page included. So the calendar loads
// on first open, and is fetched early when the trigger is hovered or focused.
const loadCalendar = () => import('@/components/ui/calendar');
const Calendar = lazy(() =>
  loadCalendar().then((module) => ({ default: module.Calendar })),
);

function preloadCalendar() {
  void loadCalendar();
}

// The month a bounded picker opens on, so a range entirely in the past or the
// future does not open on a month of disabled days.
function openingMonth(selected?: Date, min?: string, max?: string) {
  if (selected) return selected;
  const today = todayCalendarDate();
  if (min && today < min) return parseCalendarDate(min);
  if (max && today > max) return parseCalendarDate(max);
  return undefined;
}

function DatePicker({
  value,
  onValueChange,
  min,
  max,
  placeholder = 'Pick a date',
  disabled,
  id,
  ref,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selected = parseCalendarDate(value);
  const minDate = parseCalendarDate(min);
  const maxDate = parseCalendarDate(max);
  const blocked = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={ref}
        disabled={disabled}
        onPointerEnter={preloadCalendar}
        onFocus={preloadCalendar}
        render={
          <Button
            data-slot="date-picker-trigger"
            id={id}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            variant="outline"
            className={cn(
              'h-10 w-full justify-start gap-2 px-2.5 font-normal sm:h-9',
              !selected && 'text-muted-foreground',
              className,
            )}
          />
        }
      >
        <CalendarIcon />
        {selected ? formatDate(value) : placeholder}
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Suspense
          fallback={
            <div className="flex h-72 w-64 items-center justify-center">
              <Loader2
                aria-hidden="true"
                className="size-5 animate-spin text-muted-foreground"
              />
            </div>
          }
        >
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(next) => {
              onValueChange?.(next ? calendarDateOf(next) : undefined);
              setOpen(false);
            }}
            disabled={blocked.length ? blocked : undefined}
            defaultMonth={openingMonth(selected, min, max)}
            // Focus moves into a popup the user just opened, onto the selected
            // day, which is what keyboard users expect from a date picker.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
