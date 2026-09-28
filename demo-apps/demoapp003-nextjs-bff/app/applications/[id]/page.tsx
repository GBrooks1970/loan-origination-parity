import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';

import { approveApplication, declineApplication, requestHumanReview, withdrawApplication } from '@/lib/actions';
import { api, codeOf, type Application, type ApplicationActions } from '@/lib/api';
import { londonTime, money, percent, reasonOf, reasonText } from '@/lib/format';
import { ErrorMarker, Outcome, type SearchParams } from '@/lib/outcome';

import { DeclineControl } from './decline-control';

export const metadata: Metadata = { title: 'Application — Loan origination' };

type ActionKey = keyof ApplicationActions;

/** Accessible names are part of the UI contract (spec §10.2, DR-007): both UIs use these exactly. */
const ACTION_LABEL: Record<ActionKey, string> = {
    approve: 'Approve',
    decline: 'Decline',
    withdraw: 'Withdraw',
    requestHumanReview: 'Request human review',
};
const ACTION_KEYS: ActionKey[] = ['approve', 'decline', 'withdraw', 'requestHumanReview'];
const COMMAND = { approve: approveApplication, withdraw: withdrawApplication, requestHumanReview } as const;

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
    await connection();
    const { id } = await params;
    let app: Application;
    let actions: ApplicationActions;
    try {
        [app, actions] = await Promise.all([api.application(id), api.actions(id)]);
    } catch (e) {
        return (
            <>
                <h1>Application</h1>
                <ErrorMarker code={codeOf(e)} />
            </>
        );
    }
    return (
        <>
            <h1>Application {app.id}</h1>
            <dl className="facts">
                <Fact label="Status" testid="status" value={app.status} />
                <Fact label="Recommendation" testid="recommendation" value={app.recommendation} />
                <Fact label="Credit band" testid="credit-band" value={app.creditBand} />
                <Fact label="Debt service ratio" testid="dsr" value={app.debtServiceRatio} text={percent(app.debtServiceRatio)} />
                <Fact label="Amount" testid="amount" value={app.amount} text={money(app.amount)} />
                <Fact label="Term" testid="term" value={String(app.termMonths)} text={`${app.termMonths} months`} />
                <Fact label="Monthly repayment" testid="monthly-repayment" value={app.monthlyRepayment} text={money(app.monthlyRepayment)} />
                <Fact label="Decision type" testid="decision-type" value={app.decisionType ?? ''} text={app.decisionType ?? '—'} />
                <Fact label="Decline reasons" testid="decline-reasons" value={app.declineReasons.join(', ')} text={app.declineReasons.join(', ') || '—'} />
                <Fact label="Created by" testid="created-by" value={app.createdBy} />
                <Fact label="Decided by" testid="decided-by" value={app.decidedBy ?? ''} text={app.decidedBy ?? '—'} />
                <Fact label="Submitted" testid="submitted-at" value={app.submittedAt} text={londonTime(app.submittedAt)} />
                <Fact label="Reopened by human review" testid="reopened-at" value={app.reopenedAt ?? ''} text={londonTime(app.reopenedAt)} />
                <Fact label="Rule set" testid="rule-set-version" value={app.ruleSetVersion} />
            </dl>

            <h2>Rule results</h2>
            <table>
                <caption>Evaluation against rule set {app.ruleSetVersion}</caption>
                <thead>
                    <tr>
                        <th scope="col">Rule</th>
                        <th scope="col">Result</th>
                        <th scope="col">Observed</th>
                        <th scope="col">Threshold</th>
                    </tr>
                </thead>
                <tbody>
                    {app.ruleResults.map((r) => (
                        <tr key={r.rule} data-testid="rule-result" data-rule={r.rule} data-result={r.result} data-observed={r.observed} data-threshold={r.threshold}>
                            <td>{r.rule}</td>
                            <td>{r.result}</td>
                            <td>{r.observed}</td>
                            <td>{r.threshold}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h2>Actions</h2>
            <div className="actions">
                {ACTION_KEYS.map((key) => {
                    const availability = actions[key];
                    if (!availability.available) {
                        return (
                            <p key={key} className="unavailable" data-testid="action-unavailable" data-action={ACTION_LABEL[key]} data-reason={reasonOf(availability)}>
                                {ACTION_LABEL[key]} is unavailable: {reasonText(reasonOf(availability))}
                            </p>
                        );
                    }
                    if (key === 'decline') {
                        return <DeclineControl key={key} applicationId={app.id} action={declineApplication} />;
                    }
                    return (
                        <form key={key} action={COMMAND[key]} className="command">
                            <input type="hidden" name="applicationId" value={app.id} />
                            <button type="submit">{ACTION_LABEL[key]}</button>
                        </form>
                    );
                })}
            </div>
            <Outcome searchParams={searchParams} />

            <h2>Records</h2>
            <ul>
                <li>
                    <Link href={`/applications/${app.id}/audit`}>Audit trail</Link>
                </li>
                {app.status === 'DECLINED' && (
                    <li>
                        <Link href={`/applications/${app.id}/decline-notice`}>Decline notice</Link>
                    </li>
                )}
            </ul>
        </>
    );
}

function Fact({ label, testid, value, text }: { label: string; testid: string; value: string; text?: string }) {
    return (
        <>
            <dt>{label}</dt>
            <dd data-testid={testid} data-value={value}>
                {text ?? value}
            </dd>
        </>
    );
}
