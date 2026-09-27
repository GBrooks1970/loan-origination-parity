@authority @maker-checker
Feature: Maker–checker
  As a head of credit
  I want no one to approve or decline an application they created
  So that every lending decision involves two people

  Spec: §7.2 check 5. Applies to every role, including senior underwriters.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario: A second loan officer approves a colleague's application
    Given Olivia has submitted an application for 5000.00 that is awaiting approval
    When Liam approves the application
    Then the application status is "APPROVED"
    And the application was created by Olivia
    And the application was decided by Liam

  Scenario Outline: <maker> may not <command> their own application
    Given <maker> has submitted an application for 5000.00 that is awaiting approval
    When <maker> forces the "<command>" command on the application
    Then the command is refused with reason "SELF_APPROVAL"
    And the application status is "AWAITING_APPROVAL"
    And the audit trail records a denied "<command>" by <maker> with reason "SELF_APPROVAL"

    Examples:
      | maker  | command |
      | Olivia | approve |
      | Olivia | decline |
      | Sam    | approve |
