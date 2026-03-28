export default function HomePage() {
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
          <a
            href="/dashboard"
            className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Get started
          </a>
        </div>
      </div>
    </main>
  );
}
