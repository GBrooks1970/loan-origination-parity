import type { Applicant } from '@lop/domain-core';

/**
 * What one scenario has arranged and done, shared by its actors.
 * Reset before every scenario (src/support/serenity.ts).
 */
export class ScenarioState {
    private applicantCount = 0;
    pendingApplicant: Omit<Applicant, 'applicantRef'> & { applicantRef: string } | undefined;
    currentApplicationId: string | undefined;
    /** The member of staff who asks the Then questions: whoever created the current application. */
    observer: string | undefined;
    lastRefusal: string | undefined;

    nextApplicantRef(): string {
        this.applicantCount += 1;
        return `applicant-${this.applicantCount}`;
    }

    requireApplicationId(): string {
        if (!this.currentApplicationId) {
            throw new Error('No application has been created in this scenario');
        }
        return this.currentApplicationId;
    }
}

let current = new ScenarioState();

export const scenario = (): ScenarioState => current;

export function resetScenario(): void {
    current = new ScenarioState();
}
