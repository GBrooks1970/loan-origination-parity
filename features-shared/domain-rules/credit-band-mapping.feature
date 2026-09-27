@affordability
Feature: Credit band mapping
  As a credit risk manager
  I want every credit reference score mapped to exactly one credit band
  So that affordability thresholds are applied consistently

  Spec: §5.1. Bands are inclusive at both ends of each range.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role         |
      | Olivia | LOAN_OFFICER |

  Scenario Outline: Score <score> falls in band <band>
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | <score>    |
      | net monthly income            | 3000.00    |
      | monthly credit commitments    | 450.00     |
      | essential monthly expenditure | 1200.00    |
    When Olivia submits an application for 5000.00 over 36 months with a monthly repayment of 300.00
    Then the credit band is "<band>"

    Examples: Band boundaries
      | score | band |
      | 999   | A    |
      | 881   | A    |
      | 880   | B    |
      | 721   | B    |
      | 720   | C    |
      | 561   | C    |
      | 560   | D    |
      | 0     | D    |
