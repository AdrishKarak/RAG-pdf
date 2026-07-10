import { SignInButton, SignUpButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { FileText, LockKeyhole, Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function AuthPage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/');
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f6f3ee] px-4 py-10 text-zinc-950">
      <div className="mx-auto grid min-h-[calc(100vh-9rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
            <LockKeyhole className="h-4 w-4" />
            Authentication required
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-normal text-zinc-950 md:text-5xl">
            Sign in to chat with your PDFs.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
            Upload documents, retrieve source-backed context, and ask questions through the RAG assistant after you sign in.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SignInButton mode="modal" fallbackRedirectUrl="/" forceRedirectUrl="/">
              <button className="h-11 rounded-md bg-zinc-950 px-5 text-sm font-medium text-white shadow-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.98]">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal" fallbackRedirectUrl="/" forceRedirectUrl="/">
              <button className="h-11 rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-950 shadow-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.98]">
                Create Account
              </button>
            </SignUpButton>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="rounded-md bg-[#fbfaf7] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-700 text-white">
                  <Sparkles className="h-4 w-4" />
                </span>
                PDF RAG
              </div>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-500">
                Private
              </span>
            </div>

            <div className="space-y-3">
              <div className="rounded-md border border-zinc-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 h-5 w-5 text-emerald-700" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">Upload PDFs</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">Index your documents into Qdrant through the worker.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-zinc-200 bg-white p-4">
                <p className="text-sm font-semibold text-zinc-950">Ask naturally</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">Use the chat UI to get answers grounded in retrieved PDF context.</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-white p-4">
                <p className="text-sm font-semibold text-zinc-950">Keep access controlled</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">The main workspace opens only after Clerk authentication.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
