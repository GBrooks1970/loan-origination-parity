@affordability @arithmetic
Feature: Debt service ratio rounding
  As a credit risk manager
  I want the ratio rounded half-even to two decimal places before any comparison
  So that every channel reaches the same decision on boundary cases

  Spec: §4.2, §5.2; DR-008. The 400.30 case yields 35.01 under IEEE 754 floating point;
  the correct decimal result is 35.02.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role         |
      | Olivia | LOAN_OFFICER |

  Scenario Outline: Commitments of <commitments> give a ratio of <dsr> percent
    Given an applicant with:
      | date of birth                 | 1991-03-15    |
      | credit reference score        | 800           |
      | net monthly income            | 2000.00       |
      | monthly credit commitments    | <commitments> |
      | essential monthly expenditure | 800.00        |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 300.00
    Then the debt service ratio is <dsr> percent
    And the recommendation is "<recommendation>"

    Examples: Ties round to the even digit
      | commitments | dsr   | recommendation |
      | 400.10      | 35.00 | ACCEPT         |
      | 400.30      | 35.02 | REFER          |

    Examples: Non-ties round to the nearest value
      | commitments | dsr   | recommendation |
      | 400.14      | 35.01 | REFER          |
