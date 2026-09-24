'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTT } from '@/lib/i18n/tt';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  const tt = useTT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title ?? tt('Əminsiniz?', 'Are you sure?')}</DialogTitle>
          <DialogDescription>{description ?? tt('Bu əməliyyat geri qaytarıla bilməz.', 'This action cannot be undone.')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {tt('Ləğv et', 'Cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {confirmLabel ?? tt('Sil', 'Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
