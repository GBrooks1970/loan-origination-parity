@formatting
Feature: Value formatting
  As a member of staff in the UK
  I want money, percentages and times shown in British conventions and London time
  So that figures read naturally and match what customers are told

  Spec: §2, §10.2. The only feature that asserts formatted text; every other feature
  reads canonical data-value attributes (DR-007).

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario: Money and ratios use en-GB formatting
    Given Olivia has submitted an application for 25000.00 that is awaiting approval
    When Liam views the application
    Then the amount is displayed as "£25,000.00"
    And the monthly repayment is displayed as "£600.00"
    And the debt service ratio is displayed as "22.00%"

  Scenario: Times are shown in London time
    Given the current time is "2026-09-30T23:30:00Z"
    And Olivia has submitted an application for 5000.00 that is awaiting approval
    When Olivia views the application
    Then the submission time is displayed as "1 Oct 2026, 00:30"

  Scenario: Pages render without browser console errors
    Given Olivia has submitted an application for 5000.00 that is awaiting approval
    When Olivia views the application
    Then no errors are written to the browser console
