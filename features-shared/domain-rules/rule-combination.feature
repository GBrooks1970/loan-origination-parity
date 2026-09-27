@affordability @eligibility
Feature: Combining rule results
  As a credit risk manager
  I want every rule evaluated and the worst result to decide
  So that decline notices list every reason that applies

  Spec: §5.4. REFER results are never decline reasons.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role         |
      | Olivia | LOAN_OFFICER |

  Scenario: A referral is overridden by a failing rule and is not listed as a reason
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 800        |
      | net monthly income            | 2000.00    |
      | monthly credit commitments    | 300.00     |
      | essential monthly expenditure | 1000.00    |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 430.00
    Then the recommendation is "DECLINE"
    And the decline reasons are "AFFORDABILITY_RESIDUAL"
    And the audit trail records the rule results:
      | rule                | result | observed | threshold |
      | R01_AGE             | PASS   | 35       | 18        |
      | R02_CREDIT_BAND     | PASS   | B        | C         |
      | R03_DSR             | REFER  | 36.50    | 35.00     |
      | R04_RESIDUAL_INCOME | FAIL   | 270.00   | 300.00    |

  Scenario: Every failing rule is listed, in rule order
    Given an applicant with:
      | date of birth                 | 2008-10-02 |
      | credit reference score        | 800        |
      | net monthly income            | 3000.00    |
      | monthly credit commitments    | 750.00     |
      | essential monthly expenditure | 1200.00    |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 453.00
    Then the recommendation is "DECLINE"
    And the decline reasons are "ELIGIBILITY_AGE, AFFORDABILITY_DSR"
