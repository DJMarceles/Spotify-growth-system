'use client';

import { signOut, useSession } from 'next-auth/react';

export function UserNav() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name ?? 'User'}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            {(session.user.name ?? 'U')[0].toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium text-foreground">
          {session.user.name ?? session.user.email}
        </span>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
