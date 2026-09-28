import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Api, ApiError } from '../api';
import { reasonText } from '../format';

const text = () => new FormControl('', { nonNullable: true });

/**
 * Keying an application. Values are sent as typed strings: money is never parsed into a
 * JavaScript number (DR-008); validation happens in domain-core after authorisation (spec §4.3).
 */
@Component({
    selector: 'lop-new-application',
    imports: [ReactiveFormsModule],
    template: `
        <h1>New application</h1>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <fieldset>
                <legend>Applicant</legend>
                <label for="applicantRef">Applicant reference</label>
                <input id="applicantRef" formControlName="applicantRef" />
                <label for="dateOfBirth">Date of birth (YYYY-MM-DD)</label>
                <input id="dateOfBirth" formControlName="dateOfBirth" inputmode="numeric" />
                <label for="netMonthlyIncome">Net monthly income (£)</label>
                <input id="netMonthlyIncome" formControlName="netMonthlyIncome" inputmode="decimal" />
                <label for="monthlyCreditCommitments">Monthly credit commitments (£)</label>
                <input id="monthlyCreditCommitments" formControlName="monthlyCreditCommitments" inputmode="decimal" />
                <label for="essentialMonthlyExpenditure">Essential monthly expenditure (£)</label>
                <input id="essentialMonthlyExpenditure" formControlName="essentialMonthlyExpenditure" inputmode="decimal" />
            </fieldset>
            <fieldset>
                <legend>Loan</legend>
                <label for="amount">Loan amount (£)</label>
                <input id="amount" formControlName="amount" inputmode="decimal" />
                <label for="termMonths">Term (months)</label>
                <input id="termMonths" formControlName="termMonths" inputmode="numeric" />
                <label for="monthlyRepayment">Monthly repayment (£)</label>
                <input id="monthlyRepayment" formControlName="monthlyRepayment" inputmode="decimal" />
            </fieldset>
            <button type="submit" [disabled]="busy()">Submit application</button>
        </form>
        @if (error(); as code) {
            <p role="alert" class="error" data-testid="error" [attr.data-reason]="code">{{ text(code) }}</p>
        }
    `,
})
export class NewApplicationPage {
    private readonly api = inject(Api);
    private readonly router = inject(Router);
    readonly form = new FormGroup({
        applicantRef: text(),
        dateOfBirth: text(),
        netMonthlyIncome: text(),
        monthlyCreditCommitments: text(),
        essentialMonthlyExpenditure: text(),
        amount: text(),
        termMonths: text(),
        monthlyRepayment: text(),
    });
    readonly error = signal<string | null>(null);
    readonly busy = signal(false);
    readonly text = reasonText;

    async submit() {
        const v = this.form.getRawValue();
        this.error.set(null);
        this.busy.set(true);
        try {
            const created = await this.api.submit({
                applicant: {
                    applicantRef: v.applicantRef.trim(),
                    dateOfBirth: v.dateOfBirth.trim(),
                    netMonthlyIncome: v.netMonthlyIncome.trim(),
                    monthlyCreditCommitments: v.monthlyCreditCommitments.trim(),
                    essentialMonthlyExpenditure: v.essentialMonthlyExpenditure.trim(),
                },
                amount: v.amount.trim(),
                termMonths: Number.parseInt(v.termMonths, 10),
                monthlyRepayment: v.monthlyRepayment.trim(),
            });
            await this.router.navigate(['/applications', created.id]);
        } catch (e) {
            this.error.set(e instanceof ApiError ? e.code : 'UNEXPECTED_ERROR');
        } finally {
            this.busy.set(false);
        }
    }
}
