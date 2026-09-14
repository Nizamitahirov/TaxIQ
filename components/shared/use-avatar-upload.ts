'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { updateUser } from '@/lib/firebase/users';
import { resizeImageToDataUrl, resizeCoverToDataUrl } from '@/lib/utils/image';
import { toast } from '@/components/ui/toast';

/**
 * Profil şəklinin yüklənməsi/dəyişdirilməsi — Storage tələb etmədən.
 * Şəkil klient tərəfdə kiçildilir və `users/{uid}.avatarUrl` sahəsinə yazılır.
 * `openPicker` gizli fayl seçicisini açır; seçimdən sonra avtomatik yüklənir.
 */
export function useAvatarUpload() {
  const { profile, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = useCallback(async (file: File | undefined | null) => {
    if (!file || !profile?.uid) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      await updateUser(profile.uid, { avatarUrl: dataUrl });
      await refresh();
      toast.success('Profil şəkli yeniləndi');
    } catch (e) {
      toast.error('Şəkil yüklənmədi', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  }, [profile?.uid, refresh]);

  const removeAvatar = useCallback(async () => {
    if (!profile?.uid) return;
    setUploading(true);
    try {
      await updateUser(profile.uid, { avatarUrl: null });
      await refresh();
      toast.success('Profil şəkli silindi');
    } catch (e) {
      toast.error('Xəta', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  }, [profile?.uid, refresh]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  return { inputRef, uploading, openPicker, onFile, removeAvatar };
}

/**
 * Üzlük (cover) şəklinin yüklənməsi/silinməsi — `users/{uid}.coverUrl`.
 * Geniş nisbətdə kəsilib data URL kimi saxlanılır (Storage tələb etmir).
 */
export function useCoverUpload() {
  const { profile, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = useCallback(async (file: File | undefined | null) => {
    if (!file || !profile?.uid) return;
    setUploading(true);
    try {
      const dataUrl = await resizeCoverToDataUrl(file);
      await updateUser(profile.uid, { coverUrl: dataUrl });
      await refresh();
      toast.success('Üzlük şəkli yeniləndi');
    } catch (e) {
      toast.error('Şəkil yüklənmədi', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  }, [profile?.uid, refresh]);

  const removeCover = useCallback(async () => {
    if (!profile?.uid) return;
    setUploading(true);
    try {
      await updateUser(profile.uid, { coverUrl: null });
      await refresh();
      toast.success('Üzlük silindi');
    } catch (e) {
      toast.error('Xəta', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  }, [profile?.uid, refresh]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  return { inputRef, uploading, openPicker, onFile, removeCover };
}
