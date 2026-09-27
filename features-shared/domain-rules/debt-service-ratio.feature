@affordability
Feature: Debt service ratio
  As a credit risk manager
  I want the debt service ratio compared with the band's limits
  So that applicants are not lent more than they can repay

  Spec: §5.2–5.3. Band B limits: PASS up to 35.00, REFER up to 40.00, FAIL above 40.00.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role         |
      | Olivia | LOAN_OFFICER |

  Scenario Outline: A debt service ratio of <dsr> percent in band B gives <recommendation>
    Given an applicant with:
      | date of birth                 | 1991-03-15    |
      | credit reference score        | 800           |
      | net monthly income            | 3000.00       |
      | monthly credit commitments    | <commitments> |
      | essential monthly expenditure | 1200.00       |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of <repayment>
    Then the debt service ratio is <dsr> percent
    And the recommendation is "<recommendation>"

    Examples:
      | commitments | repayment | dsr   | recommendation |
      | 450.00      | 300.00    | 25.00 | ACCEPT         |
      | 600.00      | 450.00    | 35.00 | ACCEPT         |
      | 600.00      | 453.00    | 35.10 | REFER          |
      | 750.00      | 450.00    | 40.00 | REFER          |
      | 750.00      | 453.00    | 40.10 | DECLINE        |
