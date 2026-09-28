import { Interaction, Task } from '@serenity-js/core';

import { OperateTheWorkbench } from '../abilities/OperateTheWorkbench.js';
import { Refusal } from '../backend.js';
import { scenario } from '../ScenarioState.js';

export interface LoanTerms {
    amount: string;
    termMonths: number;
    monthlyRepayment: string;
}

/**
 * Submits the registered applicant's application. A refusal is recorded, not thrown,
 * so "the submission is refused with reason …" can assert it.
 */
const submission = (terms: LoanTerms, route: 'screens' | 'arranging') =>
        Task.where(
            `#actor ${route === 'arranging' ? 'has submitted' : 'submits'} an application for ${terms.amount} over ${terms.termMonths} months`,
            Interaction.where('#actor submits the application', async (actor) => {
                const state = scenario();
                const applicant = state.pendingApplicant;
                if (!applicant) {
                    throw new Error('Register an applicant before submitting an application');
                }
                const workbench = OperateTheWorkbench.as(actor);
                state.observer = workbench.username;
                state.lastRefusal = undefined;
                try {
                    const via = route === 'arranging' ? workbench.arranging() : workbench;
                    const application = await via.submit({ applicant, ...terms });
                    state.currentApplicationId = application.id;
                } catch (error) {
                    if (!(error instanceof Refusal)) throw error;
                    state.lastRefusal = error.code;
                }
            }),
        );

export const SubmitApplication = {
    /** The actor keys and submits the application on this surface. */
    for: (terms: LoanTerms) => submission(terms, 'screens'),
    /** A precondition: arranged through the engine or API on every surface. */
    asPrecondition: (terms: LoanTerms) => submission(terms, 'arranging'),
};
