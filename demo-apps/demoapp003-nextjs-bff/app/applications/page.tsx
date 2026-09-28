import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';

import { api, codeOf, type Application, type StaffActions } from '@/lib/api';
import { londonTime, money, reasonOf, reasonText } from '@/lib/format';
import { ErrorMarker } from '@/lib/outcome';

export const metadata: Metadata = { title: 'Applications — Loan origination' };

export default async function QueuePage() {
    await connection();
    let applications: Application[] = [];
    let actions: StaffActions | null = null;
    let error: string | null = null;
    try {
        [applications, actions] = await Promise.all([api.applications(), api.staffActions()]);
    } catch (e) {
        error = codeOf(e);
    }
    return (
        <>
            <h1>Applications</h1>
            {actions &&
                (actions.submit.available ? (
                    <p>
                        <Link href="/applications/new" className="button">
                            New application
                        </Link>
                    </p>
                ) : (
                    <p className="unavailable" data-testid="action-unavailable" data-action="New application" data-reason={reasonOf(actions.submit)}>
                        New application is unavailable: {reasonText(reasonOf(actions.submit))}
                    </p>
                ))}
            {error && <ErrorMarker code={error} />}
            <table>
                <caption>All applications, oldest first</caption>
                <thead>
                    <tr>
                        <th scope="col">Application</th>
                        <th scope="col">Status</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Created by</th>
                        <th scope="col">Submitted</th>
                    </tr>
                </thead>
                <tbody>
                    {applications.length ? (
                        applications.map((app) => (
                            <tr key={app.id} data-testid="application-row" data-id={app.id}>
                                <td>
                                    <Link href={`/applications/${app.id}`}>{app.id}</Link>
                                </td>
                                <td data-testid="status" data-value={app.status}>
                                    {app.status}
                                </td>
                                <td data-testid="amount" data-value={app.amount}>
                                    {money(app.amount)}
                                </td>
                                <td>{app.createdBy}</td>
                                <td>{londonTime(app.submittedAt)}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5}>No applications yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </>
    );
}
