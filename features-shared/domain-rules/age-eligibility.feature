@eligibility
Feature: Minimum age eligibility
  As a compliance officer
  I want applicants under 18 on the business date declined
  So that credit is never extended to minors

  Spec: §5, rule R01_AGE. Age is measured on the business date in Europe/London.
  A 29 February birthday is treated as 1 March in non-leap years (specification decision).

  Background:
    Given the following staff members:
      | name   | role         |
      | Olivia | LOAN_OFFICER |

  Scenario Outline: Born <date of birth>, applying at <time>, is <age>
    Given the current time is "<time>"
    And an applicant with:
      | date of birth                 | <date of birth> |
      | credit reference score        | 800             |
      | net monthly income            | 3000.00         |
      | monthly credit commitments    | 450.00          |
      | essential monthly expenditure | 1200.00         |
    When Olivia submits an application for 5000.00 over 36 months with a monthly repayment of 300.00
    Then the recommendation is "<recommendation>"
    And the audit trail records the rule results:
      | rule    | result   | observed | threshold |
      | R01_AGE | <result> | <age>    | 18        |

    Examples: Eighteenth birthday
      | date of birth | time                 | age | result | recommendation |
      | 2008-10-01    | 2026-10-01T09:00:00Z | 18  | PASS   | ACCEPT         |
      | 2008-10-02    | 2026-10-01T09:00:00Z | 17  | FAIL   | DECLINE        |

    Examples: Business date follows London time, not UTC
      | date of birth | time                 | age | result | recommendation |
      | 2008-10-01    | 2026-09-30T23:30:00Z | 18  | PASS   | ACCEPT         |
      | 2008-10-01    | 2026-09-30T22:59:59Z | 17  | FAIL   | DECLINE        |

    Examples: Leap-day birthday in a non-leap year
      | date of birth | time                 | age | result | recommendation |
      | 2008-02-29    | 2026-02-28T12:00:00Z | 17  | FAIL   | DECLINE        |
      | 2008-02-29    | 2026-03-01T12:00:00Z | 18  | PASS   | ACCEPT         |
