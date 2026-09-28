import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
    Application,
    ApplicationActions,
    AuditEvent,
    DeclineNotice,
    NewApplication,
    StaffActions,
    StaffMember,
} from '@lop/domain-core';

export type { Application, ApplicationActions, AuditEvent, DeclineNotice, NewApplication, StaffActions, StaffMember };

/** A refusal or error from the Node API, carrying its problem+json code. */
export class ApiError extends Error {
    constructor(
        readonly code: string,
        readonly status: number,
    ) {
        super(code);
    }
}

/** Thin client over the Node service (DR-004): no business rules live in the SPA. */
@Injectable({ providedIn: 'root' })
export class Api {
    private readonly http = inject(HttpClient);

    signIn(username: string) {
        return this.call(this.http.post<void>('/api/v1/session', { username }));
    }
    me() {
        return this.call(this.http.get<StaffMember>('/api/v1/me'));
    }
    staffActions() {
        return this.call(this.http.get<StaffActions>('/api/v1/me/actions'));
    }
    applications() {
        return this.call(this.http.get<Application[]>('/api/v1/applications'));
    }
    application(id: string) {
        return this.call(this.http.get<Application>(`/api/v1/applications/${id}`));
    }
    actions(id: string) {
        return this.call(this.http.get<ApplicationActions>(`/api/v1/applications/${id}/actions`));
    }
    submit(body: NewApplication) {
        return this.call(this.http.post<Application>('/api/v1/applications', body));
    }
    approve(id: string) {
        return this.call(this.http.post<Application>(`/api/v1/applications/${id}/approve`, {}));
    }
    decline(id: string, reason: string) {
        return this.call(this.http.post<Application>(`/api/v1/applications/${id}/decline`, { reason }));
    }
    withdraw(id: string) {
        return this.call(this.http.post<Application>(`/api/v1/applications/${id}/withdraw`, {}));
    }
    requestHumanReview(id: string) {
        return this.call(this.http.post<Application>(`/api/v1/applications/${id}/human-review`, {}));
    }
    auditTrail(id: string) {
        return this.call(this.http.get<AuditEvent[]>(`/api/v1/applications/${id}/audit`));
    }
    declineNotice(id: string) {
        return this.call(this.http.get<DeclineNotice>(`/api/v1/applications/${id}/decline-notice`));
    }

    private async call<T>(request: import('rxjs').Observable<T>): Promise<T> {
        try {
            return await firstValueFrom(request);
        } catch (error) {
            if (error instanceof HttpErrorResponse) {
                const code = typeof error.error?.code === 'string' ? error.error.code : 'UNEXPECTED_ERROR';
                throw new ApiError(code, error.status);
            }
            throw error;
        }
    }
}
