import { defineParameterType } from '@cucumber/cucumber';

/** A member of staff from the Background table, e.g. Olivia. */
defineParameterType({ name: 'actor', regexp: /[A-Z][a-z]+/, transformer: (name: string) => name });

/** A two-decimal number, kept as a string so no floating point is involved (DR-008). */
defineParameterType({ name: 'money', regexp: /\d+\.\d{2}/, transformer: (value: string) => value });
