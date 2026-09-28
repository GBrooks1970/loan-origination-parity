import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api, ApiError, type DeclineNotice } from '../api';
import { reasonText } from '../format';

/** Customer-facing text only (spec §9): no rule IDs, thresholds or scores. */
@Component({
    selector: 'lop-decline-notice',
    imports: [RouterLink],
    template: `
        <h1>Decline notice</h1>
        <p><a [routerLink]="['/applications', id()]">Back to application</a></p>
        @if (notice(); as n) {
            <h2>Why we could not approve this application</h2>
            <ul>
                @for (r of n.reasons; track r.code) {
                    <li data-testid="decline-reason" [attr.data-code]="r.code">{{ r.text }}</li>
                }
            </ul>
            <p data-testid="agency" [attr.data-value]="n.creditReferenceAgencyName ?? ''">
                @if (n.creditReferenceAgencyDisclosed) {
                    We used information from {{ n.creditReferenceAgencyName }}.
                } @else {
                    No credit reference agency information decided this outcome.
                }
            </p>
            <p data-testid="human-review-offer" [attr.data-value]="n.humanReviewAvailable">
                @if (n.humanReviewAvailable) {
                    You can ask for a person to review this decision within 30 days.
                } @else {
                    This decision was made by a person.
                }
            </p>
        }
        @if (error(); as code) {
            <p role="alert" class="error" data-testid="error" [attr.data-reason]="code">{{ text(code) }}</p>
        }
    `,
})
export class DeclineNoticePage {
    private readonly api = inject(Api);
    readonly id = input.required<string>();
    readonly notice = signal<DeclineNotice | null>(null);
    readonly error = signal<string | null>(null);
    readonly text = reasonText;

    constructor() {
        effect(() => {
            this.api.declineNotice(this.id()).then(
                (n) => this.notice.set(n),
                (e: unknown) => this.error.set(e instanceof ApiError ? e.code : 'UNEXPECTED_ERROR'),
            );
        });
    }
}
