@audit
Feature: Rule-level audit trace
  As an auditor
  I want every rule's result, observed value and threshold recorded for every evaluation
  So that any decision can be reconstructed and explained

  Spec: §8. All four rules are recorded even when an earlier rule fails.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role         |
      | Olivia | LOAN_OFFICER |

  Scenario: An accepted application records all four rules against rule set 2026.10
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 800        |
      | net monthly income            | 3000.00    |
      | monthly credit commitments    | 450.00     |
      | essential monthly expenditure | 1200.00    |
    When Olivia submits an application for 5000.00 over 36 months with a monthly repayment of 300.00
    Then the recommendation is "ACCEPT"
    And the decline reasons are "none"
    And the evaluation used rule set "2026.10"
    And the audit trail records the rule results:
      | rule                | result | observed | threshold |
      | R01_AGE             | PASS   | 35       | 18        |
      | R02_CREDIT_BAND     | PASS   | B        | C         |
      | R03_DSR             | PASS   | 25.00    | 35.00     |
      | R04_RESIDUAL_INCOME | PASS   | 1050.00  | 300.00    |

  Scenario: A band D decline still records the ratio and residual income
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 500        |
      | net monthly income            | 4000.00    |
      | monthly credit commitments    | 800.00     |
      | essential monthly expenditure | 1500.00    |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 600.00
    Then the recommendation is "DECLINE"
    And the decline reasons are "CREDIT_HISTORY"
    And the audit trail records the rule results:
      | rule                | result         | observed | threshold |
      | R01_AGE             | PASS           | 35       | 18        |
      | R02_CREDIT_BAND     | FAIL           | D        | C         |
      | R03_DSR             | NOT_APPLICABLE | 35.00    | none      |
      | R04_RESIDUAL_INCOME | PASS           | 1100.00  | 300.00    |
