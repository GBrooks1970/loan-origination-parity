@accessibility
Feature: Accessibility
  As a member of staff who uses assistive technology
  I want every workbench page to meet WCAG 2.2 AA
  So that I can do my job without barriers

  Spec: §10.2. Checked with axe-core using the wcag2a, wcag2aa, wcag21aa and wcag22aa rule tags.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario Outline: The <page> page has no serious or critical violations
    Given Olivia has submitted an application that was declined
    When Olivia views the <page> page
    Then the page has no accessibility violations of serious or critical impact

    Examples:
      | page                |
      | application queue   |
      | new application     |
      | application detail  |
      | audit trail         |
      | decline notice      |

  Scenario: An application can be submitted using only the keyboard
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 800        |
      | net monthly income            | 3000.00    |
      | monthly credit commitments    | 450.00     |
      | essential monthly expenditure | 1200.00    |
    When Olivia submits an application for 5000.00 over 36 months with a monthly repayment of 300.00 using only the keyboard
    Then the application status is "AWAITING_APPROVAL"
