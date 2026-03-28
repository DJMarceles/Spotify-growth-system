import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LoginButton } from '@/components/auth/login-button';

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          Release Loop OS
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Release intelligence and execution platform. Analyze your discovery context, build
          container playlists, and run structured release cycles.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <LoginButton />
        </div>
      </div>
    </main>
  );
}
