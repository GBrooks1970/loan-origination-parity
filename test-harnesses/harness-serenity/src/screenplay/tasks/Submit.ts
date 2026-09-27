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
export const SubmitApplication = {
    for: (terms: LoanTerms) =>
        Task.where(
            `#actor submits an application for ${terms.amount} over ${terms.termMonths} months`,
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
                    const application = await workbench.submit({ applicant, ...terms });
                    state.currentApplicationId = application.id;
                } catch (error) {
                    if (!(error instanceof Refusal)) throw error;
                    state.lastRefusal = error.code;
                }
            }),
        ),
};
