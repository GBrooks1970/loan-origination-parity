import type { Routes } from '@angular/router';

import { ApplicationDetail } from './pages/application-detail';
import { AuditTrail } from './pages/audit-trail';
import { DeclineNoticePage } from './pages/decline-notice';
import { NewApplicationPage } from './pages/new-application';
import { Queue } from './pages/queue';
import { SignIn } from './pages/sign-in';

/** Spec §10.2 page list. */
export const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'applications' },
    ...(LOP_TEST_MODE ? [{ path: 'sign-in', component: SignIn, title: 'Sign in — Loan origination' }] : []),
    { path: 'applications', component: Queue, title: 'Applications — Loan origination' },
    { path: 'applications/new', component: NewApplicationPage, title: 'New application — Loan origination' },
    { path: 'applications/:id', component: ApplicationDetail, title: 'Application — Loan origination' },
    { path: 'applications/:id/audit', component: AuditTrail, title: 'Audit trail — Loan origination' },
    { path: 'applications/:id/decline-notice', component: DeclineNoticePage, title: 'Decline notice — Loan origination' },
];
