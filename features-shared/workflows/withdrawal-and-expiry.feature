@lifecycle
Feature: Withdrawal and expiry
  As a loan officer
  I want to withdraw my own open applications, and stale ones to expire
  So that queues contain only live decisions

  Spec: §6.2–6.3. Expiry is strict at 30 days and applied on the next read or command.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario: The creator withdraws an open application
    Given Olivia has submitted an application for 5000.00 that is awaiting approval
    When Olivia withdraws the application
    Then the application status is "WITHDRAWN"

  Scenario: Another officer may not withdraw it
    Given Olivia has submitted an application for 5000.00 that is awaiting approval
    When Liam forces the "withdraw" command on the application
    Then the command is refused with reason "NOT_APPLICATION_OWNER"
    And the application status is "AWAITING_APPROVAL"

  Scenario: A decided application cannot be withdrawn
    Given Olivia has submitted an application for 5000.00 that is awaiting approval
    And Liam has approved the application
    When Olivia forces the "withdraw" command on the application
    Then the command is refused with reason "INVALID_STATE"
    And the application status is "APPROVED"

  Scenario Outline: At <time> the application is <status>
    Given Olivia has submitted an application for 5000.00 that is awaiting approval
    When the current time is "<time>"
    Then the application status is "<status>"

    Examples:
      | time                 | status            |
      | 2026-10-31T09:00:00Z | AWAITING_APPROVAL |
      | 2026-10-31T09:00:01Z | EXPIRED           |

  Scenario: An expired application cannot be approved
    Given Olivia has submitted an application for 5000.00 that is awaiting approval
    When the current time is "2026-11-01T09:00:00Z"
    And Liam forces the "approve" command on the application
    Then the command is refused with reason "INVALID_STATE"
    And the application status is "EXPIRED"
    And the audit trail records a status change from "AWAITING_APPROVAL" to "EXPIRED" by "system"
