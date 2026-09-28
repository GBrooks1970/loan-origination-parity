import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { Api, ApiError } from '../api';
import { reasonText } from '../format';

/** Fixture sign-in, present only in test builds (DR-012). */
@Component({
    selector: 'lop-sign-in',
    imports: [ReactiveFormsModule],
    template: `
        <h1>Sign in</h1>
        <form (submit)="$event.preventDefault(); signIn()">
            <label for="username">Username</label>
            <input id="username" [formControl]="username" autocomplete="username" />
            <button type="submit">Sign in</button>
        </form>
        @if (error(); as code) {
            <p role="alert" class="error" data-testid="error" [attr.data-reason]="code">{{ text(code) }}</p>
        }
    `,
})
export class SignIn {
    private readonly api = inject(Api);
    private readonly router = inject(Router);
    readonly username = new FormControl('', { nonNullable: true, validators: [Validators.required] });
    readonly error = signal<string | null>(null);
    readonly text = reasonText;

    async signIn() {
        try {
            await this.api.signIn(this.username.value);
            await this.router.navigateByUrl('/applications');
        } catch (e) {
            this.error.set(e instanceof ApiError ? e.code : 'UNEXPECTED_ERROR');
        }
    }
}
