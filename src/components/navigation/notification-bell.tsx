'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  initialUnreadCount: number;
}

export function NotificationBell({ initialUnreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('notifications');
  const tc = useTranslations('common');
  // Live WS-driven updates land in Part 3. Part 1 surfaces only the initial
  // server-rendered count.
  const unread = initialUnreadCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={tc('openNotifications')}
          className={cn(
            'relative inline-flex h-10 w-10 items-center justify-center rounded-[12px]',
            'text-ink-2 hover:bg-surface-muted hover:text-ink transition-colors duration-120',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          )}
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={2.25} />
          {unread > 0 ? (
            <span
              aria-label={`${unread} unread`}
              className="absolute top-1.5 right-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-red text-white text-[10px] font-semibold px-1 border-2 border-bg"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 h-12">
          <div className="text-[13px] font-semibold text-ink">{t('title')}</div>
          {unread > 0 ? (
            <button className="text-caption text-ink-3 hover:text-ink transition-colors">
              {t('markAllRead')}
            </button>
          ) : null}
        </div>
        <div className="p-6 text-center">
          {/* Stub — live inbox comes in Part 3 */}
          <div className="mx-auto h-14 w-14 rounded-full bg-brand-yellow-50 flex items-center justify-center mb-3">
            <Bell className="h-5 w-5 text-[#a16800]" strokeWidth={2.25} />
          </div>
          <p className="text-[13.5px] font-semibold text-ink">{t('empty')}</p>
          <p className="text-[12.5px] text-ink-3 mt-1">{t('emptyBody')}</p>
        </div>
        <div className="border-t border-line p-2">
          <Button variant="ghost" fullWidth size="sm" asChild>
            <a href="/notifications">{t('seeAll')}</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
