import { DataTable, Given } from '@cucumber/cucumber';
import { actorCalled } from '@serenity-js/core';
import { ROLES, type Role } from '@lop/domain-core';

import { ChangeRole, EnrolStaff, RegisterApplicant, SetTheClock } from '../screenplay/tasks/Arrange.js';
import { STAGE_MANAGER } from '../support/serenity.js';

const stageManager = () => actorCalled(STAGE_MANAGER);

function asRole(value: string): Role {
    if (!(ROLES as readonly string[]).includes(value)) {
        throw new Error(`Unknown role ${value}`);
    }
    return value as Role;
}

Given('the current time is {string}', (instant: string) => stageManager().attemptsTo(SetTheClock.to(instant)));

Given('the following staff members:', (table: DataTable) =>
    stageManager().attemptsTo(
        EnrolStaff.from(table.hashes().map((row) => ({ username: row.name!, role: asRole(row.role!) }))),
    ),
);

Given("{actor}'s role is changed to {string}", (name: string, role: string) =>
    stageManager().attemptsTo(ChangeRole.of(name).to(asRole(role))),
);

Given('an applicant with:', (table: DataTable) => {
    const row = table.rowsHash();
    return stageManager().attemptsTo(
        RegisterApplicant.with({
            dateOfBirth: row['date of birth']!,
            creditReferenceScore: Number(row['credit reference score']),
            netMonthlyIncome: row['net monthly income']!,
            monthlyCreditCommitments: row['monthly credit commitments']!,
            essentialMonthlyExpenditure: row['essential monthly expenditure']!,
        }),
    );
});
