@submission
Feature: Application submission
  As a loan officer
  I want each submitted application evaluated and routed immediately
  So that accepted cases reach an approver and declined applicants are told promptly

  Spec: §4.3, §6.2. Refusals are driven through the command, not a hidden control.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario: An accepted application waits for a second person to approve it
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 800        |
      | net monthly income            | 3000.00    |
      | monthly credit commitments    | 450.00     |
      | essential monthly expenditure | 1200.00    |
    When Olivia submits an application for 5000.00 over 36 months with a monthly repayment of 300.00
    Then the application status is "AWAITING_APPROVAL"
    And the application was created by Olivia

  Scenario: A referred application goes to a senior underwriter's queue
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 650        |
      | net monthly income            | 4000.00    |
      | monthly credit commitments    | 800.00     |
      | essential monthly expenditure | 1500.00    |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 600.00
    Then the application status is "REFERRED"

  Scenario: A declined application is closed by an automated decision
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 500        |
      | net monthly income            | 4000.00    |
      | monthly credit commitments    | 800.00     |
      | essential monthly expenditure | 1500.00    |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 600.00
    Then the application status is "DECLINED"
    And the decision type is "AUTOMATED"

  Scenario Outline: Amount <amount> over <term> months is within product limits
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 800        |
      | net monthly income            | 3000.00    |
      | monthly credit commitments    | 450.00     |
      | essential monthly expenditure | 1200.00    |
    When Olivia submits an application for <amount> over <term> months with a monthly repayment of <repayment>
    Then the application status is "AWAITING_APPROVAL"

    Examples:
      | amount   | term | repayment |
      | 1000.00  | 12   | 90.00     |
      | 25000.00 | 60   | 520.00    |

  Scenario Outline: Amount <amount> over <term> months is refused as <code>
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 800        |
      | net monthly income            | 3000.00    |
      | monthly credit commitments    | 450.00     |
      | essential monthly expenditure | 1200.00    |
    When Olivia submits an application for <amount> over <term> months with a monthly repayment of 300.00
    Then the submission is refused with reason "<code>"
    And no application has been created

    Examples:
      | amount   | term | code                |
      | 999.99   | 36   | AMOUNT_OUT_OF_RANGE |
      | 25000.01 | 36   | AMOUNT_OUT_OF_RANGE |
      | 5000.00  | 11   | TERM_OUT_OF_RANGE   |
      | 5000.00  | 61   | TERM_OUT_OF_RANGE   |
