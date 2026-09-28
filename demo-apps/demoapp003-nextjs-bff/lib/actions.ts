'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { api, codeOf, fixtureSession, NAMESPACE_COOKIE, SESSION_COOKIE, testMode } from './api';

/**
 * Server Actions (spec §10.3). Each delegates to the Node API, revalidates the affected routes and
 * redirects: post/redirect/get, with the outcome in the target URL (`?done=` or `?refused=<code>`),
 * so a form works the same with or without JavaScript (DR-017). The Node service decides; nothing
 * here re-checks authorisation (DR-004, DR-015).
 */

const field = (form: FormData, name: string): string => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
};

const detail = (id: string) => `/applications/${encodeURIComponent(id)}`;

async function command(form: FormData, name: string, run: (id: string) => Promise<unknown>): Promise<never> {
    const id = field(form, 'applicationId');
    let outcome: string;
    try {
        await run(id);
        outcome = `done=${name}`;
    } catch (error) {
        outcome = `refused=${encodeURIComponent(codeOf(error))}`;
    }
    revalidatePath('/applications', 'layout');
    redirect(`${detail(id)}?${outcome}`);
}

export async function approveApplication(form: FormData): Promise<never> {
    return command(form, 'approve', (id) => api.approve(id));
}

export async function declineApplication(form: FormData): Promise<never> {
    return command(form, 'decline', (id) => api.decline(id, field(form, 'reason')));
}

export async function withdrawApplication(form: FormData): Promise<never> {
    return command(form, 'withdraw', (id) => api.withdraw(id));
}

export async function requestHumanReview(form: FormData): Promise<never> {
    return command(form, 'human-review', (id) => api.requestHumanReview(id));
}

/** Values are sent as typed strings: money is never parsed into a JavaScript number (DR-008). */
export async function submitApplication(form: FormData): Promise<never> {
    const value = (name: string) => field(form, name).trim();
    let target: string;
    try {
        const created = await api.submit({
            applicant: {
                applicantRef: value('applicantRef'),
                dateOfBirth: value('dateOfBirth'),
                netMonthlyIncome: value('netMonthlyIncome'),
                monthlyCreditCommitments: value('monthlyCreditCommitments'),
                essentialMonthlyExpenditure: value('essentialMonthlyExpenditure'),
            },
            amount: value('amount'),
            termMonths: Number.parseInt(value('termMonths'), 10),
            monthlyRepayment: value('monthlyRepayment'),
        });
        target = `${detail(created.id)}?done=submit`;
    } catch (error) {
        target = `/applications/new?refused=${encodeURIComponent(codeOf(error))}`;
    }
    revalidatePath('/applications', 'layout');
    redirect(target);
}

/** Fixture sign-in (DR-012): exists only in test mode. */
export async function signIn(form: FormData): Promise<never> {
    if (!testMode()) notFound();
    const jar = await cookies();
    const result = await fixtureSession(field(form, 'username'), jar.get(NAMESPACE_COOKIE)?.value);
    if (result.status === 204 && result.session) {
        jar.set(SESSION_COOKIE, result.session, { httpOnly: true, sameSite: 'lax', path: '/' });
        redirect('/applications');
    }
    let code = 'UNEXPECTED_ERROR';
    try {
        const parsed = JSON.parse(result.body) as { code?: unknown };
        if (typeof parsed.code === 'string') code = parsed.code;
    } catch {
        // not problem+json
    }
    redirect(`/sign-in?refused=${encodeURIComponent(code)}`);
}
