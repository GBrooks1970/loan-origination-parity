import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';

import { api, codeOf, type AuditEvent } from '@/lib/api';
import { londonTime } from '@/lib/format';
import { ErrorMarker } from '@/lib/outcome';

export const metadata: Metadata = { title: 'Audit trail — Loan origination' };

export default async function AuditTrailPage({ params }: { params: Promise<{ id: string }> }) {
    await connection();
    const { id } = await params;
    let events: AuditEvent[] = [];
    let error: string | null = null;
    try {
        events = await api.auditTrail(id);
    } catch (e) {
        error = codeOf(e);
    }
    return (
        <>
            <h1>Audit trail for {id}</h1>
            <p>
                <Link href={`/applications/${id}`}>Back to application</Link>
            </p>
            {error && <ErrorMarker code={error} />}
            <table>
                <caption>Events in sequence order</caption>
                <thead>
                    <tr>
                        <th scope="col">#</th>
                        <th scope="col">Time</th>
                        <th scope="col">Event</th>
                        <th scope="col">Actor</th>
                        <th scope="col">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {events.map((e) => (
                        <tr key={e.sequence} data-testid="audit-event" data-type={e.type} data-actor={e.actor} data-payload={JSON.stringify(e.payload)}>
                            <td>{e.sequence}</td>
                            <td>{londonTime(e.at)}</td>
                            <td>{e.type}</td>
                            <td>{e.actor}</td>
                            <td>
                                <code>{JSON.stringify(e.payload)}</code>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
