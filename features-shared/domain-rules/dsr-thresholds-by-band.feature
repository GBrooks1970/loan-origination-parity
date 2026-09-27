@affordability
Feature: Debt service ratio thresholds by credit band
  As a credit risk manager
  I want stronger credit bands to tolerate a higher debt service ratio
  So that lending appetite reflects credit risk

  Spec: §5.3. The same 35.00 percent ratio passes in bands A and B, refers in band C,
  and is not applicable in band D, which is declined on credit history alone.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role         |
      | Olivia | LOAN_OFFICER |

  Scenario Outline: A 35.00 percent ratio in band <band> gives <recommendation>
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | <score>    |
      | net monthly income            | 4000.00    |
      | monthly credit commitments    | 800.00     |
      | essential monthly expenditure | 1500.00    |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 600.00
    Then the credit band is "<band>"
    And the debt service ratio is 35.00 percent
    And the recommendation is "<recommendation>"
    And the audit trail records the rule results:
      | rule    | result   | observed | threshold   |
      | R03_DSR | <result> | 35.00    | <threshold> |

    Examples:
      | score | band | result         | threshold | recommendation |
      | 900   | A    | PASS           | 40.00     | ACCEPT         |
      | 800   | B    | PASS           | 35.00     | ACCEPT         |
      | 650   | C    | REFER          | 30.00     | REFER          |
      | 500   | D    | NOT_APPLICABLE | none      | DECLINE        |
