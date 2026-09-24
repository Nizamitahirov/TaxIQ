'use client';

import { useRef } from 'react';
import { Printer, X, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTT } from '@/lib/i18n/tt';

/**
 * Sənəd önizləyicisi — HTML sənədini yükləmədən birbaşa tətbiq daxilində göstərir.
 * iframe `srcDoc` ilə izolyasiya olunmuş şəkildə render edir; çap/yeni pəncərə seçimləri verir.
 */
export function DocumentViewer({
  open, onOpenChange, html, title, subtitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  html: string | null;
  title?: string;
  subtitle?: string;
}) {
  const tt = useTT();
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  function print() {
    const win = frameRef.current?.contentWindow;
    if (win) { win.focus(); win.print(); }
  }

  function openInNewTab() {
    if (!html) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 [&>button.absolute]:hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title ?? tt('Sənəd önizləməsi', 'Document preview')}</p>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={openInNewTab}><ExternalLink className="h-4 w-4" /> {tt('Yeni pəncərə', 'New tab')}</Button>
            <Button size="sm" onClick={print}><Printer className="h-4 w-4" /> {tt('Çap et', 'Print')}</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label={tt('Bağla', 'Close')}><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-muted/40">
          {html ? (
            <iframe
              ref={frameRef}
              title={title ?? 'document'}
              srcDoc={html}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-same-origin allow-modals"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
