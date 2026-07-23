"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { firebaseAuth, googleProvider, hasFirebaseConfig } from "./lib/firebase";

export default function Home() {
  const [isAuth, setIsAuth] = useState(false);
  const [userName, setUserName] = useState("");
  const [authError, setAuthError] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
    if (!firebaseAuth) return;
    const unsubscribeAuth = firebaseAuth.onAuthStateChanged((user) => {
      setIsAuth(Boolean(user));
      setUserName(user?.displayName || "Warehouse associate");
    });
    return () => unsubscribeAuth();
  }, []);

  const handleLogin = async () => {
    setAuthError("");
    if (!firebaseAuth || !googleProvider) {
      setAuthError("Firebase is not configured. Please add your Firebase credentials in .env.local.");
      return;
    }

    try {
      const isMobile = typeof window !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(firebaseAuth, googleProvider);
        return;
      }

      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (error) {
      if (error instanceof Error && error.message.includes("popup")) {
        try {
          await signInWithRedirect(firebaseAuth, googleProvider);
        } catch (redirectError) {
          setAuthError(redirectError instanceof Error ? redirectError.message : "Google sign-in failed. Check Firebase config.");
        }
        return;
      }

      if (error instanceof Error) {
        setAuthError(error.message);
      } else {
        setAuthError("Google sign-in failed. Check Firebase config.");
      }
    }
  };

  if (!isReady) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-4 text-slate-800 sm:p-8">
        <section className="mx-auto flex max-w-6xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-500">Loading</p>
          <h1 className="text-2xl font-semibold text-slate-900">Preparing the inventory workspace…</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf2f8,_#f5f3ff_60%,_#ffffff)] p-4 text-slate-800 sm:p-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-3xl border border-pink-100 bg-white/80 p-6 shadow-lg shadow-pink-100 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-500">Nulook Inventory</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Women&apos;s fashion inventory control</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">Choose a workspace to search products, view locations, or assign items to one or many locations.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">{isAuth ? userName : "Guest mode"}</span>
              {isAuth ? (
                <button onClick={() => signOut(firebaseAuth!)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">Sign out</button>
              ) : (
                <button
                  onClick={handleLogin}
                  disabled={!hasFirebaseConfig || !isReady}
                  className={`rounded-full px-4 py-2 text-sm font-medium text-white transition ${hasFirebaseConfig ? "bg-pink-600 hover:bg-pink-700" : "cursor-not-allowed bg-slate-400 hover:bg-slate-400"}`}
                >
                  Continue with Google
                </button>
              )}
            </div>
          </div>
        </header>

        {authError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</div> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/lookup" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-pink-300 hover:shadow-md">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-500">01</p>
            <h2 className="mt-3 text-xl font-semibold">Item lookup</h2>
            <p className="mt-2 text-sm text-slate-600">Search items by number, name, or category and see their assigned locations.</p>
          </Link>
          <Link href="/locations" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-pink-300 hover:shadow-md">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-500">02</p>
            <h2 className="mt-3 text-xl font-semibold">Location hierarchy</h2>
            <p className="mt-2 text-sm text-slate-600">Create nested locations, inspect every location, and delete them with ease.</p>
          </Link>
          <Link href="/assign" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-pink-300 hover:shadow-md">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-500">03</p>
            <h2 className="mt-3 text-xl font-semibold">Assign items</h2>
            <p className="mt-2 text-sm text-slate-600">Select an item and assign it to one or many locations in a single view.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
