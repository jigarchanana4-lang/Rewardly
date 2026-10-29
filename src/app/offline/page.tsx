export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl">📡</div>
      <h1 className="mt-3 text-xl font-extrabold">You’re offline</h1>
      <p className="mt-1 text-ink-2">Reconnect to collect stamps and view rewards.</p>
    </main>
  );
}
