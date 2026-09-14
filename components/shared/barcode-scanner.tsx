'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, ScanBarcode, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Barkod skaneri — brauzerin `BarcodeDetector` API-si + kamera (05 §2).
 * Dəstəklənmirsə (məs. Safari) əl ilə daxiletməyə keçir.
 */
interface Props { open: boolean; onOpenChange: (o: boolean) => void; onDetected: (code: string) => void }

// BarcodeDetector tip elanı (bütün TS lib-lərində yoxdur)
type BD = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export function BarcodeScanner({ open, onOpenChange, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const Ctor = (window as unknown as { BarcodeDetector?: new (o?: unknown) => BD }).BarcodeDetector;

    async function start() {
      if (!Ctor || !navigator.mediaDevices?.getUserMedia) { setSupported(false); return; }
      setSupported(true);
      try {
        const detector = new Ctor({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) { finish(codes[0].rawValue); return; }
          } catch { /* frame skip */ }
          raf = requestAnimationFrame(scan);
        };
        raf = requestAnimationFrame(scan);
      } catch {
        setError('Kameraya giriş verilmədi. Əl ilə daxil edin.');
        setSupported(false);
      }
    }
    function finish(code: string) { stopped = true; cleanup(); onDetected(code); onOpenChange(false); }
    function cleanup() { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); }
    start();
    return () => { stopped = true; cleanup(); };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-4 w-4 text-primary" /> Barkod skan</DialogTitle></DialogHeader>
        {supported === null ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : supported ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" playsInline muted />
            <p className="text-center text-xs text-muted-foreground">Barkodu kameraya tutun…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {error && <p className="text-xs text-danger">{error}</p>}
            <p className="text-sm text-muted-foreground">Bu brauzer kamera skanını dəstəkləmir. Barkodu əl ilə daxil edin:</p>
            <div className="flex gap-2">
              <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Barkod" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && manual.trim()) { onDetected(manual.trim()); onOpenChange(false); } }} />
              <Button onClick={() => { if (manual.trim()) { onDetected(manual.trim()); onOpenChange(false); } }}>OK</Button>
            </div>
          </div>
        )}
        <button onClick={() => onOpenChange(false)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </DialogContent>
    </Dialog>
  );
}
