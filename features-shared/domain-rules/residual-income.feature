@affordability
Feature: Residual income
  As a credit risk manager
  I want applicants to keep at least 300.00 a month after essentials and repayments
  So that a new loan does not leave them unable to meet living costs

  Spec: §5, rule R04_RESIDUAL_INCOME. The minimum is inclusive.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role         |
      | Olivia | LOAN_OFFICER |

  Scenario Outline: Residual income of <residual> gives <recommendation>
    Given an applicant with:
      | date of birth                 | 1991-03-15    |
      | credit reference score        | 800           |
      | net monthly income            | <income>      |
      | monthly credit commitments    | <commitments> |
      | essential monthly expenditure | <essential>   |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 400.00
    Then the recommendation is "<recommendation>"
    And the decline reasons are "<reasons>"
    And the audit trail records the rule results:
      | rule                | result   | observed   | threshold |
      | R04_RESIDUAL_INCOME | <result> | <residual> | 300.00    |

    Examples:
      | income  | commitments | essential | residual | result | recommendation | reasons                                   |
      | 2500.00 | 300.00      | 1500.00   | 300.00   | PASS   | ACCEPT         | none                                      |
      | 2500.00 | 300.00      | 1500.01   | 299.99   | FAIL   | DECLINE        | AFFORDABILITY_RESIDUAL                    |
      | 2000.00 | 500.00      | 900.00    | 200.00   | FAIL   | DECLINE        | AFFORDABILITY_DSR, AFFORDABILITY_RESIDUAL |
