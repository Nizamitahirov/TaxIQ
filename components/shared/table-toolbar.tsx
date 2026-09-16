'use client';

import { type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useTT } from '@/lib/i18n/tt';

export interface FilterSelect {
  /** Cari dəyər ('' = hamısı) */
  value: string;
  onChange: (v: string) => void;
  /** '' dəyəri avtomatik "Hamısı" kimi əlavə olunur */
  options: { value: string; label: string }[];
  placeholder?: string;
  /** "Hamısı" seçimini göstərmə */
  allLabel?: string;
  width?: string;
}

/**
 * Cədvəllər üçün kontekstual filter paneli — axtarış + select filterlər + nəticə sayı.
 * Bütün siyahı səhifələrində eyni ergonomikanı təmin edir.
 */
export function TableToolbar({
  search, onSearch, searchPlaceholder, selects = [], count, total, right, children,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  selects?: FilterSelect[];
  /** Filtrdən sonrakı nəticə sayı */
  count?: number;
  /** Ümumi say (filtrsiz) */
  total?: number;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const tt = useTT();
  const hasActiveFilters = (search ?? '') !== '' || selects.some((s) => s.value !== '');

  function clearAll() {
    onSearch?.('');
    selects.forEach((s) => s.onChange(''));
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {onSearch && (
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder ?? tt('Axtar…', 'Search…')}
            className="h-9 pl-8"
          />
        </div>
      )}
      {selects.map((s, i) => (
        <Select key={i} value={s.value || '__all__'} onValueChange={(v) => s.onChange(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-auto min-w-[130px] gap-1.5" style={s.width ? { width: s.width } : undefined}>
            <SelectValue placeholder={s.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{s.allLabel ?? tt('Hamısı', 'All')}</SelectItem>
            {s.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
      {children}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={clearAll}>
          <X className="h-4 w-4" /> {tt('Təmizlə', 'Clear')}
        </Button>
      )}
      <div className="ml-auto flex items-center gap-3">
        {typeof count === 'number' && (
          <span className="text-xs text-muted-foreground">
            {typeof total === 'number' && total !== count ? `${count} / ${total}` : count}
          </span>
        )}
        {right}
      </div>
    </div>
  );
}
