@authority
Feature: Approval authority limits
  As a head of credit
  I want each role limited to approving and declining loans up to its delegated authority
  So that larger lending decisions are taken by more senior staff

  Spec: §7.1–7.2. Limits are inclusive: LOAN_OFFICER 10000.00, UNDERWRITER 20000.00,
  SENIOR_UNDERWRITER 25000.00. AUDITOR has no authority.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario Outline: <approver> may approve <amount>
    Given Olivia has submitted an application for <amount> that is awaiting approval
    When <approver> approves the application
    Then the application status is "APPROVED"
    And the application was decided by <approver>

    Examples:
      | approver | amount   |
      | Liam     | 10000.00 |
      | Uma      | 5000.00  |
      | Uma      | 20000.00 |
      | Sam      | 25000.00 |

  Scenario Outline: <approver> may not approve <amount>
    Given Olivia has submitted an application for <amount> that is awaiting approval
    When <approver> forces the "approve" command on the application
    Then the command is refused with reason "<code>"
    And the application status is "AWAITING_APPROVAL"
    And the audit trail records a denied "approve" by <approver> with reason "<code>"

    Examples:
      | approver | amount   | code               |
      | Liam     | 10000.01 | LIMIT_EXCEEDED     |
      | Uma      | 20000.01 | LIMIT_EXCEEDED     |
      | Aled     | 1000.00  | ROLE_NOT_PERMITTED |

  Scenario: Declining is subject to the same limit
    Given Olivia has submitted an application for 15000.00 that is awaiting approval
    When Liam forces the "decline" command on the application
    Then the command is refused with reason "LIMIT_EXCEEDED"
    And the application status is "AWAITING_APPROVAL"

  Scenario: An underwriter declines within their limit
    Given Olivia has submitted an application for 15000.00 that is awaiting approval
    When Uma declines the application with the reason "Affordability evidence not provided"
    Then the application status is "DECLINED"
    And the decision type is "MANUAL"
    And the decline reasons are "UNDERWRITER_DECISION"
