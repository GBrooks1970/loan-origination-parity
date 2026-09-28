'use client';

import { useState } from 'react';

/**
 * The one piece of client state on the workbench: "Decline" reveals the reason form, as on
 * Angular. The form is server-rendered and hidden rather than created on click, so it carries the
 * same progressive-enhancement action reference as every other command form (DR-017, DR-018).
 * It posts to a Server Action (passed in), so the Node service decides.
 */
export function DeclineControl({ applicationId, action }: { applicationId: string; action: (form: FormData) => Promise<never> }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                Decline
            </button>
            <form action={action} className="decline" hidden={!open}>
                <input type="hidden" name="applicationId" value={applicationId} />
                <label htmlFor="declineReason">Reason</label>
                <textarea id="declineReason" name="reason" rows={3} />
                <button type="submit">Confirm decline</button>
            </form>
        </>
    );
}
