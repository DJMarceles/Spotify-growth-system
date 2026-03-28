import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LoginButton } from '@/components/auth/login-button';

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome to Release Loop OS
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Sign in with your Spotify account to analyze your discovery context and build intelligent
          release strategies.
        </p>
        <div className="mt-8">
          <LoginButton />
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          We use official Spotify APIs only. Your credentials are never stored directly — we use
          secure OAuth tokens that you can revoke at any time from your Spotify account settings.
        </p>
      </div>
    </main>
  );
}
