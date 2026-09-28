import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';

import { api, codeOf, type DeclineNotice } from '@/lib/api';
import { ErrorMarker } from '@/lib/outcome';

export const metadata: Metadata = { title: 'Decline notice — Loan origination' };

/** Customer-facing text only (spec §9): no rule IDs, thresholds or scores. */
export default async function DeclineNoticePage({ params }: { params: Promise<{ id: string }> }) {
    await connection();
    const { id } = await params;
    let notice: DeclineNotice | null = null;
    let error: string | null = null;
    try {
        notice = await api.declineNotice(id);
    } catch (e) {
        error = codeOf(e);
    }
    return (
        <>
            <h1>Decline notice</h1>
            <p>
                <Link href={`/applications/${id}`}>Back to application</Link>
            </p>
            {notice && (
                <>
                    <h2>Why we could not approve this application</h2>
                    <ul>
                        {notice.reasons.map((r) => (
                            <li key={r.code} data-testid="decline-reason" data-code={r.code}>
                                {r.text}
                            </li>
                        ))}
                    </ul>
                    <p data-testid="agency" data-value={notice.creditReferenceAgencyName ?? ''}>
                        {notice.creditReferenceAgencyDisclosed
                            ? `We used information from ${notice.creditReferenceAgencyName}.`
                            : 'No credit reference agency information decided this outcome.'}
                    </p>
                    <p data-testid="human-review-offer" data-value={String(notice.humanReviewAvailable)}>
                        {notice.humanReviewAvailable
                            ? 'You can ask for a person to review this decision within 30 days.'
                            : 'This decision was made by a person.'}
                    </p>
                </>
            )}
            {error && <ErrorMarker code={error} />}
        </>
    );
}
