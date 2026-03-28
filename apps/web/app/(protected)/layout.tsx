import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { SessionProvider } from '@/components/providers/session-provider';
import { AppNav } from '@/components/nav/app-nav';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <SessionProvider>
      <div className="min-h-screen bg-background">
        <AppNav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </SessionProvider>
  );
}
