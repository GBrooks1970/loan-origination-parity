import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api, ApiError, type Application, type StaffActions } from '../api';
import { londonTime, money, reasonOf, reasonText } from '../format';

@Component({
    selector: 'lop-queue',
    imports: [RouterLink],
    template: `
        <h1>Applications</h1>
        @if (staffActions(); as actions) {
            @if (actions.submit.available) {
                <p><a routerLink="/applications/new" class="button">New application</a></p>
            } @else {
                <p class="unavailable" data-testid="action-unavailable" data-action="New application" [attr.data-reason]="reasonOf(actions.submit)">
                    New application is unavailable: {{ text(reasonOf(actions.submit)) }}
                </p>
            }
        }
        @if (error(); as code) {
            <p role="alert" class="error" data-testid="error" [attr.data-reason]="code">{{ text(code) }}</p>
        }
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
                @for (app of applications(); track app.id) {
                    <tr data-testid="application-row" [attr.data-id]="app.id">
                        <td><a [routerLink]="['/applications', app.id]">{{ app.id }}</a></td>
                        <td data-testid="status" [attr.data-value]="app.status">{{ app.status }}</td>
                        <td data-testid="amount" [attr.data-value]="app.amount">{{ money(app.amount) }}</td>
                        <td>{{ app.createdBy }}</td>
                        <td>{{ time(app.submittedAt) }}</td>
                    </tr>
                } @empty {
                    <tr><td colspan="5">No applications yet.</td></tr>
                }
            </tbody>
        </table>
    `,
})
export class Queue {
    private readonly api = inject(Api);
    readonly applications = signal<Application[]>([]);
    readonly staffActions = signal<StaffActions | null>(null);
    readonly error = signal<string | null>(null);
    readonly money = money;
    readonly time = londonTime;
    readonly text = reasonText;
    readonly reasonOf = reasonOf;

    constructor() {
        void this.load();
    }

    private async load() {
        try {
            const [applications, actions] = await Promise.all([this.api.applications(), this.api.staffActions()]);
            this.applications.set(applications);
            this.staffActions.set(actions);
        } catch (e) {
            this.error.set(e instanceof ApiError ? e.code : 'UNEXPECTED_ERROR');
        }
    }
}
