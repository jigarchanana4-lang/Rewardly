import { Suspense } from "react";
import PhoneAuthForm from "@/components/PhoneAuthForm";

export const metadata = { title: "Sign in" };

export default function AuthPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Suspense fallback={<div className="text-center text-ink-2">Loading…</div>}>
        <PhoneAuthForm />
      </Suspense>
    </main>
  );
}
