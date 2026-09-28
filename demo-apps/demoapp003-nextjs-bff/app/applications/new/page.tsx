import type { Metadata } from 'next';
import { connection } from 'next/server';

import { submitApplication } from '@/lib/actions';
import { Outcome, type SearchParams } from '@/lib/outcome';

export const metadata: Metadata = { title: 'New application — Loan origination' };

/** Keying an application. Validation happens in domain-core after authorisation (spec §4.3). */
export default async function NewApplicationPage({ searchParams }: { searchParams: SearchParams }) {
    await connection();
    return (
        <>
            <h1>New application</h1>
            <form action={submitApplication} noValidate>
                <fieldset>
                    <legend>Applicant</legend>
                    <label htmlFor="applicantRef">Applicant reference</label>
                    <input id="applicantRef" name="applicantRef" />
                    <label htmlFor="dateOfBirth">Date of birth (YYYY-MM-DD)</label>
                    <input id="dateOfBirth" name="dateOfBirth" inputMode="numeric" />
                    <label htmlFor="netMonthlyIncome">Net monthly income (£)</label>
                    <input id="netMonthlyIncome" name="netMonthlyIncome" inputMode="decimal" />
                    <label htmlFor="monthlyCreditCommitments">Monthly credit commitments (£)</label>
                    <input id="monthlyCreditCommitments" name="monthlyCreditCommitments" inputMode="decimal" />
                    <label htmlFor="essentialMonthlyExpenditure">Essential monthly expenditure (£)</label>
                    <input id="essentialMonthlyExpenditure" name="essentialMonthlyExpenditure" inputMode="decimal" />
                </fieldset>
                <fieldset>
                    <legend>Loan</legend>
                    <label htmlFor="amount">Loan amount (£)</label>
                    <input id="amount" name="amount" inputMode="decimal" />
                    <label htmlFor="termMonths">Term (months)</label>
                    <input id="termMonths" name="termMonths" inputMode="numeric" />
                    <label htmlFor="monthlyRepayment">Monthly repayment (£)</label>
                    <input id="monthlyRepayment" name="monthlyRepayment" inputMode="decimal" />
                </fieldset>
                <button type="submit">Submit application</button>
            </form>
            <Outcome searchParams={searchParams} />
        </>
    );
}
