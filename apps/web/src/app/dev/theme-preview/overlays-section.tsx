import {
  Bell,
  LogOut,
  Mail,
  MoreHorizontal,
  Settings,
  Trash2,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useConfirm } from '@/systems/confirmation';
import { FormSheet, formFields } from '@/systems/form';
import { PreviewSection, Specimen } from './preview-layout';
import { useFailingMutation } from './use-failing-mutation';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

const PENDING_MS = 1500;

const noteSchema = z.object({
  title: z.string().min(1, 'Enter a title'),
  body: z.string(),
});

const NoteField = formFields(noteSchema);

export function OverlaysSection() {
  const confirm = useConfirm();
  const failing = useFailingMutation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const [density, setDensity] = useState('comfortable');

  return (
    <PreviewSection
      id="overlays"
      description="Dialogs, sheets, confirm() in every variant, menus, popovers and tooltips. All of them portal to the body, so they follow the theme toggle like the rest of the page."
    >
      <Specimen label="Dialog">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            Open dialog
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename workspace</DialogTitle>
              <DialogDescription>
                Dialog with a header, body and footer. Escape, the close button
                and the backdrop all close it.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm">
              The body scrolls with the page on a short viewport.
            </p>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <DialogClose
                render={<Button />}
                onClick={() => toast.success('Saved')}
              >
                Save
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Specimen>

      <Specimen label="Sheet">
        {SIDES.map((side) => (
          <Sheet key={side}>
            <SheetTrigger render={<Button variant="outline" />}>
              Sheet {side}
            </SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Sheet from the {side}</SheetTitle>
                <SheetDescription>
                  Slides in from its side and fades the backdrop.
                </SheetDescription>
              </SheetHeader>
              <SheetFooter>
                <Button onClick={() => toast('Sheet action')}>Action</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ))}
        <Button variant="outline" onClick={() => setSheetOpen(true)}>
          FormSheet
        </Button>
        <FormSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="New note"
          description="FormSheet: a Form inside a sheet with FormError and FormActions."
          schema={noteSchema}
          submitLabel="Create note"
          onSubmit={(values) => {
            toast.success(`Note "${values.title}" created`);
            setSheetOpen(false);
          }}
        >
          <NoteField.Input name="title" label="Title" required />
          <NoteField.Textarea name="body" label="Body" />
        </FormSheet>
      </Specimen>

      <Specimen label="AlertDialog">
        {(['default', 'sm'] as const).map((size) => (
          <AlertDialog key={size}>
            <AlertDialogTrigger render={<Button variant="outline" />}>
              AlertDialog {size}
            </AlertDialogTrigger>
            <AlertDialogContent size={size}>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
                <AlertDialogDescription>
                  The AlertDialog primitive at size {size}. confirm() below is
                  the usual way to get one.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction>Leave</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
      </Specimen>

      <Specimen label="confirm()">
        <Button
          variant="outline"
          onClick={() =>
            confirm({
              title: 'Send the report now?',
              description: 'Default variant.',
              onConfirm: () => {
                toast.success('Report sent');
              },
            })
          }
        >
          Default
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            confirm({
              title: 'Delete this project?',
              description: 'Destructive variant. This cannot be undone.',
              variant: 'destructive',
              onConfirm: () => {
                toast.success('Project deleted');
              },
            })
          }
        >
          Destructive
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            confirm({
              title: 'Reset every setting?',
              description: 'Warning variant.',
              variant: 'warning',
              onConfirm: () => {
                toast.success('Settings reset');
              },
            })
          }
        >
          Warning
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            confirm({
              title: 'Archive 24 records?',
              description: `Pending: onConfirm takes ${PENDING_MS / 1000} seconds. Both buttons lock and Escape does nothing until it settles.`,
              confirmText: 'Archive',
              pendingText: 'Archiving',
              onConfirm: async () => {
                await new Promise((resolve) => setTimeout(resolve, PENDING_MS));
                toast.success('24 records archived');
              },
            })
          }
        >
          Pending
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            confirm({
              title: 'Publish these changes?',
              description:
                'Rejecting: onConfirm runs a mutation that fails. The dialog stays open and the global mutation error toast reports it.',
              confirmText: 'Publish',
              pendingText: 'Publishing',
              onConfirm: () => failing.mutateAsync(),
            })
          }
        >
          Rejecting
        </Button>
      </Specimen>

      <Specimen label="Dropdown menu and popover">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            <MoreHorizontal />
            Dropdown menu
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => toast('Profile')}>
                <User />
                Profile
                <DropdownMenuShortcut>Ctrl P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast('Settings')}>
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Mail />
                Disabled item
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={notify}
              onCheckedChange={setNotify}
            >
              <Bell />
              Notifications
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Density</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={density}
                onValueChange={(value: unknown) => setDensity(String(value))}
              >
                <DropdownMenuRadioItem value="comfortable">
                  Comfortable
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="compact">
                  Compact
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => toast('Export')}>
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast('Print')}>
                  Print
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => toast('Delete')}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast('Sign out')}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            Popover
          </PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Popover title</PopoverTitle>
              <PopoverDescription>
                PopoverHeader, PopoverTitle and PopoverDescription.
              </PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      </Specimen>

      <Specimen label="Tooltip">
        {SIDES.map((side) => (
          <Tooltip key={side}>
            <TooltipTrigger render={<Button variant="outline" />}>
              Tooltip {side}
            </TooltipTrigger>
            <TooltipContent side={side}>Tooltip on the {side}</TooltipContent>
          </Tooltip>
        ))}
      </Specimen>
    </PreviewSection>
  );
}
