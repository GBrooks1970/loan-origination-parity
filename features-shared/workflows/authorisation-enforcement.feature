@security
Feature: Server-side authorisation enforcement
  As a head of information security
  I want every command authorised by the server, whatever the user interface shows
  So that hiding a button is never the only control

  Spec: §7.2–7.3; DR-010, DR-012. "Forces" means the command reaches the server without
  the user interface offering it: a direct API call, or a tampered form on Next.js.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario Outline: An auditor may not "<command>"
    Given Olivia has submitted an application that was <outcome>
    When Aled forces the "<command>" command on the application
    Then the command is refused with reason "ROLE_NOT_PERMITTED"
    And the application status is "<status>"
    And the audit trail records a denied "<command>" by Aled with reason "ROLE_NOT_PERMITTED"

    Examples:
      | outcome  | command              | status   |
      | referred | approve              | REFERRED |
      | referred | decline              | REFERRED |
      | referred | withdraw             | REFERRED |
      | declined | request human review | DECLINED |

  Scenario: A visitor who is not signed in is refused
    Given Olivia has submitted an application for 5000.00 that is awaiting approval
    When a visitor who is not signed in forces the "approve" command on the application
    Then the command is refused with reason "UNAUTHENTICATED"
    And the application status is "AWAITING_APPROVAL"

  Scenario: A change of role takes effect on the next command
    Given Olivia has submitted an application for 15000.00 that is awaiting approval
    And Liam's role is changed to "UNDERWRITER"
    When Liam approves the application
    Then the application status is "APPROVED"
