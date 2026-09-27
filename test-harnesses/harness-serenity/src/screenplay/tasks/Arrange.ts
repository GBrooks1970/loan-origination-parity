import { Interaction, Task, type UsesAbilities } from '@serenity-js/core';
import type { Role } from '@lop/domain-core';

import { ControlTheTestEnvironment } from '../abilities/ControlTheTestEnvironment.js';
import { scenario } from '../ScenarioState.js';

const control = (actor: UsesAbilities) => ControlTheTestEnvironment.as(actor).backend;

export const SetTheClock = {
    to: (instant: string) =>
        Interaction.where(`#actor sets the clock to ${instant}`, (actor) => control(actor).setClock(instant)),
};

export const EnrolStaff = {
    from: (entries: { username: string; role: Role }[]) =>
        Interaction.where(`#actor enrols ${entries.map((e) => e.username).join(', ')}`, (actor) =>
            control(actor).setStaff(entries),
        ),
};

export const ChangeRole = {
    of: (username: string) => ({
        to: (role: Role) =>
            Interaction.where(`#actor changes ${username}'s role to ${role}`, (actor) =>
                control(actor).changeRole(username, role),
            ),
    }),
};

export interface ApplicantDetails {
    dateOfBirth: string;
    creditReferenceScore: number;
    netMonthlyIncome: string;
    monthlyCreditCommitments: string;
    essentialMonthlyExpenditure: string;
}

/** Registers the applicant's fixture credit score and holds their details for the next submission. */
export const RegisterApplicant = {
    with: (details: ApplicantDetails) =>
        Task.where(
            `#actor registers an applicant with credit reference score ${details.creditReferenceScore}`,
            Interaction.where('#actor sets the fixture credit reference score', async (actor) => {
                const applicantRef = scenario().nextApplicantRef();
                await control(actor).setCreditScore(applicantRef, details.creditReferenceScore);
                scenario().pendingApplicant = {
                    applicantRef,
                    dateOfBirth: details.dateOfBirth,
                    netMonthlyIncome: details.netMonthlyIncome,
                    monthlyCreditCommitments: details.monthlyCreditCommitments,
                    essentialMonthlyExpenditure: details.essentialMonthlyExpenditure,
                };
            }),
        ),
};
