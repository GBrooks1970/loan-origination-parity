import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import { signIn } from '@/lib/actions';
import { testMode } from '@/lib/api';
import { Outcome, type SearchParams } from '@/lib/outcome';

export const metadata: Metadata = { title: 'Sign in — Loan origination' };

/** Fixture sign-in, present only in test mode (DR-012). */
export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
    await connection();
    if (!testMode()) notFound();
    return (
        <>
            <h1>Sign in</h1>
            <form action={signIn}>
                <label htmlFor="username">Username</label>
                <input id="username" name="username" autoComplete="username" />
                <button type="submit">Sign in</button>
            </form>
            <Outcome searchParams={searchParams} />
        </>
    );
}
