import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api, ApiError, type AuditEvent } from '../api';
import { londonTime, reasonText } from '../format';

@Component({
    selector: 'lop-audit-trail',
    imports: [RouterLink],
    template: `
        <h1>Audit trail for {{ id() }}</h1>
        <p><a [routerLink]="['/applications', id()]">Back to application</a></p>
        @if (error(); as code) {
            <p role="alert" class="error" data-testid="error" [attr.data-reason]="code">{{ text(code) }}</p>
        }
        <table>
            <caption>Events in sequence order</caption>
            <thead>
                <tr><th scope="col">#</th><th scope="col">Time</th><th scope="col">Event</th><th scope="col">Actor</th><th scope="col">Details</th></tr>
            </thead>
            <tbody>
                @for (e of events(); track e.sequence) {
                    <tr data-testid="audit-event" [attr.data-type]="e.type" [attr.data-actor]="e.actor" [attr.data-payload]="json(e.payload)">
                        <td>{{ e.sequence }}</td>
                        <td>{{ time(e.at) }}</td>
                        <td>{{ e.type }}</td>
                        <td>{{ e.actor }}</td>
                        <td><code>{{ json(e.payload) }}</code></td>
                    </tr>
                }
            </tbody>
        </table>
    `,
})
export class AuditTrail {
    private readonly api = inject(Api);
    readonly id = input.required<string>();
    readonly events = signal<AuditEvent[]>([]);
    readonly error = signal<string | null>(null);
    readonly time = londonTime;
    readonly text = reasonText;
    readonly json = (value: unknown) => JSON.stringify(value);

    constructor() {
        effect(() => {
            const id = this.id();
            this.api.auditTrail(id).then(
                (events) => this.events.set(events),
                (e: unknown) => this.error.set(e instanceof ApiError ? e.code : 'UNEXPECTED_ERROR'),
            );
        });
    }
}
