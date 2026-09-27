import { Interaction, Task, type UsesAbilities } from '@serenity-js/core';

import { OperateTheWorkbench } from '../abilities/OperateTheWorkbench.js';
import { Refusal } from '../backend.js';
import { scenario } from '../ScenarioState.js';

export type CommandName = 'approve' | 'decline' | 'withdraw' | 'request human review';

/** Used when a forced decline needs a reason; the reason is never what the scenario is about. */
const FORCED_DECLINE_REASON = 'Forced by the test harness';

function perform(actor: UsesAbilities, command: CommandName, reason?: string) {
    const workbench = OperateTheWorkbench.as(actor);
    const id = scenario().requireApplicationId();
    switch (command) {
        case 'approve':
            return workbench.approve(id);
        case 'decline':
            return workbench.decline(id, reason ?? FORCED_DECLINE_REASON);
        case 'withdraw':
            return workbench.withdraw(id);
        case 'request human review':
            return workbench.requestHumanReview(id);
    }
}

/** A command the actor is entitled to: any refusal fails the scenario. */
export const CarryOut = {
    the: (command: CommandName, reason?: string) =>
        Task.where(
            `#actor carries out "${command}" on the application`,
            Interaction.where(`#actor ${command}s the application`, async (actor) => {
                await perform(actor, command, reason);
            }),
        ),
};

/**
 * Drives a command straight at the server without relying on any control being offered (spec §12, DR-010).
 * The outcome is recorded for "the command is refused with reason …".
 */
export const Force = {
    the: (command: CommandName) =>
        Task.where(
            `#actor forces the "${command}" command on the application`,
            Interaction.where(`#actor forces "${command}"`, async (actor) => {
                const state = scenario();
                state.lastRefusal = undefined;
                try {
                    await perform(actor, command);
                } catch (error) {
                    if (!(error instanceof Refusal)) throw error;
                    state.lastRefusal = error.code;
                }
            }),
        ),
};
