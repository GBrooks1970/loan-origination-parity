import { Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Api, ApiError, type Application, type ApplicationActions } from '../api';
import { londonTime, money, percent, reasonOf, reasonText } from '../format';

type ActionKey = keyof ApplicationActions;

/** Accessible names are part of the UI contract (spec §10.2, DR-007): both UIs use these exactly. */
const ACTION_LABEL: Record<ActionKey, string> = {
    approve: 'Approve',
    decline: 'Decline',
    withdraw: 'Withdraw',
    requestHumanReview: 'Request human review',
};

@Component({
    selector: 'lop-application-detail',
    imports: [RouterLink, ReactiveFormsModule],
    template: `
        @if (application(); as app) {
            <h1>Application {{ app.id }}</h1>
            <dl class="facts">
                <dt>Status</dt><dd data-testid="status" [attr.data-value]="app.status">{{ app.status }}</dd>
                <dt>Recommendation</dt><dd data-testid="recommendation" [attr.data-value]="app.recommendation">{{ app.recommendation }}</dd>
                <dt>Credit band</dt><dd data-testid="credit-band" [attr.data-value]="app.creditBand">{{ app.creditBand }}</dd>
                <dt>Debt service ratio</dt><dd data-testid="dsr" [attr.data-value]="app.debtServiceRatio">{{ percent(app.debtServiceRatio) }}</dd>
                <dt>Amount</dt><dd data-testid="amount" [attr.data-value]="app.amount">{{ money(app.amount) }}</dd>
                <dt>Term</dt><dd data-testid="term" [attr.data-value]="app.termMonths">{{ app.termMonths }} months</dd>
                <dt>Monthly repayment</dt><dd data-testid="monthly-repayment" [attr.data-value]="app.monthlyRepayment">{{ money(app.monthlyRepayment) }}</dd>
                <dt>Decision type</dt><dd data-testid="decision-type" [attr.data-value]="app.decisionType ?? ''">{{ app.decisionType ?? '—' }}</dd>
                <dt>Decline reasons</dt><dd data-testid="decline-reasons" [attr.data-value]="app.declineReasons.join(', ')">{{ app.declineReasons.join(', ') || '—' }}</dd>
                <dt>Created by</dt><dd data-testid="created-by" [attr.data-value]="app.createdBy">{{ app.createdBy }}</dd>
                <dt>Decided by</dt><dd data-testid="decided-by" [attr.data-value]="app.decidedBy ?? ''">{{ app.decidedBy ?? '—' }}</dd>
                <dt>Submitted</dt><dd data-testid="submitted-at" [attr.data-value]="app.submittedAt">{{ time(app.submittedAt) }}</dd>
                <dt>Reopened by human review</dt><dd data-testid="reopened-at" [attr.data-value]="app.reopenedAt ?? ''">{{ time(app.reopenedAt) }}</dd>
                <dt>Rule set</dt><dd data-testid="rule-set-version" [attr.data-value]="app.ruleSetVersion">{{ app.ruleSetVersion }}</dd>
            </dl>

            <h2>Rule results</h2>
            <table>
                <caption>Evaluation against rule set {{ app.ruleSetVersion }}</caption>
                <thead>
                    <tr><th scope="col">Rule</th><th scope="col">Result</th><th scope="col">Observed</th><th scope="col">Threshold</th></tr>
                </thead>
                <tbody>
                    @for (r of app.ruleResults; track r.rule) {
                        <tr data-testid="rule-result" [attr.data-rule]="r.rule" [attr.data-result]="r.result" [attr.data-observed]="r.observed" [attr.data-threshold]="r.threshold">
                            <td>{{ r.rule }}</td><td>{{ r.result }}</td><td>{{ r.observed }}</td><td>{{ r.threshold }}</td>
                        </tr>
                    }
                </tbody>
            </table>

            <h2>Actions</h2>
            @if (actions(); as available) {
                <div class="actions">
                    @for (key of actionKeys; track key) {
                        @if (available[key].available) {
                            <button type="button" (click)="act(key)" [disabled]="busy()">{{ label[key] }}</button>
                        } @else {
                            <p class="unavailable" data-testid="action-unavailable" [attr.data-action]="label[key]" [attr.data-reason]="reasonOf(available[key])">
                                {{ label[key] }} is unavailable: {{ text(reasonOf(available[key])) }}
                            </p>
                        }
                    }
                </div>
            }
            @if (declining()) {
                <form (submit)="$event.preventDefault(); confirmDecline()">
                    <label for="declineReason">Reason</label>
                    <textarea id="declineReason" [formControl]="declineReason" rows="3"></textarea>
                    <button type="submit" [disabled]="busy()">Confirm decline</button>
                </form>
            }
            @if (error(); as code) {
                <p role="alert" class="error" data-testid="error" [attr.data-reason]="code">{{ text(code) }}</p>
            }

            <h2>Records</h2>
            <ul>
                <li><a [routerLink]="['/applications', app.id, 'audit']">Audit trail</a></li>
                @if (app.status === 'DECLINED') {
                    <li><a [routerLink]="['/applications', app.id, 'decline-notice']">Decline notice</a></li>
                }
            </ul>
        } @else if (error(); as code) {
            <h1>Application</h1>
            <p role="alert" class="error" data-testid="error" [attr.data-reason]="code">{{ text(code) }}</p>
        } @else {
            <h1>Application</h1>
            <p>Loading…</p>
        }
    `,
})
export class ApplicationDetail {
    private readonly api = inject(Api);
    readonly id = input.required<string>();
    readonly application = signal<Application | null>(null);
    readonly actions = signal<ApplicationActions | null>(null);
    readonly error = signal<string | null>(null);
    readonly busy = signal(false);
    readonly declining = signal(false);
    readonly declineReason = new FormControl('', { nonNullable: true });
    readonly actionKeys: ActionKey[] = ['approve', 'decline', 'withdraw', 'requestHumanReview'];
    readonly label = ACTION_LABEL;
    readonly money = money;
    readonly percent = percent;
    readonly time = londonTime;
    readonly text = reasonText;
    readonly reasonOf = reasonOf;

    constructor() {
        effect(() => {
            void this.load(this.id());
        });
    }

    async act(key: ActionKey) {
        if (key === 'decline') {
            this.declining.set(true);
            return;
        }
        const id = this.id();
        await this.run(() =>
            key === 'approve' ? this.api.approve(id) : key === 'withdraw' ? this.api.withdraw(id) : this.api.requestHumanReview(id),
        );
    }

    async confirmDecline() {
        const id = this.id();
        await this.run(() => this.api.decline(id, this.declineReason.value));
        if (!this.error()) this.declining.set(false);
    }

    private async run(command: () => Promise<Application>) {
        this.busy.set(true);
        this.error.set(null);
        try {
            await command();
            await this.load(this.id());
        } catch (e) {
            this.error.set(e instanceof ApiError ? e.code : 'UNEXPECTED_ERROR');
        } finally {
            this.busy.set(false);
        }
    }

    private async load(id: string) {
        try {
            const [application, actions] = await Promise.all([this.api.application(id), this.api.actions(id)]);
            this.application.set(application);
            this.actions.set(actions);
        } catch (e) {
            this.error.set(e instanceof ApiError ? e.code : 'UNEXPECTED_ERROR');
        }
    }
}
