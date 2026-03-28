'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserNav } from '@/components/auth/user-nav';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/artists', label: 'Artists' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/playlists', label: 'Playlists' },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-lg font-bold text-foreground">
            Release Loop
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <UserNav />
      </div>
    </header>
  );
}
