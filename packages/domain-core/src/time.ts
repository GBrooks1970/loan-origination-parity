/** Business dates are evaluated in Europe/London (spec §2). */

const LONDON_DATE = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

export interface CalendarDate {
    year: number;
    month: number;
    day: number;
}

export function londonDate(instant: Date): CalendarDate {
    const parts = Object.fromEntries(LONDON_DATE.formatToParts(instant).map((p) => [p.type, p.value]));
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

export function parseIsoDate(value: string): CalendarDate {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        throw new Error(`Not an ISO date: ${value}`);
    }
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Whole years on the London business date.
 * A 29 February birthday is treated as 1 March in non-leap years (spec §5, specification decision).
 */
export function ageOn(dateOfBirth: CalendarDate, now: Date): number {
    const today = londonDate(now);
    let { month, day } = dateOfBirth;
    if (month === 2 && day === 29 && !isLeapYear(today.year)) {
        month = 3;
        day = 1;
    }
    const birthdayNotYetReached = today.month < month || (today.month === month && today.day < day);
    return today.year - dateOfBirth.year - (birthdayNotYetReached ? 1 : 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(instant: Date, days: number): Date {
    return new Date(instant.getTime() + days * DAY_MS);
}
