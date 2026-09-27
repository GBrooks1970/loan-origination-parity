@authority @affordance
Feature: Role-based affordances
  As a member of staff
  I want to be offered only the actions I am allowed to take, and told why others are unavailable
  So that I do not attempt decisions outside my authority

  Spec: §7, §10.2. Affordances are usability, not enforcement; enforcement is proven in
  workflows/authorisation-enforcement.feature. Preconditions are arranged through the API.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario Outline: <viewer> is offered "<action>" on an application for <amount>
    Given Olivia has submitted an application for <amount> that is awaiting approval
    When <viewer> views the application
    Then the "<action>" action is offered

    Examples:
      | viewer | amount   | action   |
      | Liam   | 10000.00 | Approve  |
      | Uma    | 15000.00 | Approve  |
      | Uma    | 15000.00 | Decline  |
      | Olivia | 5000.00  | Withdraw |

  Scenario Outline: <viewer> is not offered "<action>" on an application for <amount>
    Given Olivia has submitted an application for <amount> that is awaiting approval
    When <viewer> views the application
    Then the "<action>" action is unavailable because "<code>"

    Examples:
      | viewer | amount   | action   | code                  |
      | Liam   | 10000.01 | Approve  | LIMIT_EXCEEDED        |
      | Olivia | 5000.00  | Approve  | SELF_APPROVAL         |
      | Aled   | 5000.00  | Approve  | ROLE_NOT_PERMITTED    |
      | Liam   | 5000.00  | Withdraw | NOT_APPLICATION_OWNER |

  Scenario: A senior underwriter is offered a decision on a referral
    Given Olivia has submitted an application that was referred
    When Sam views the application
    Then the "Approve" action is offered

  Scenario: An underwriter is not offered a decision on a referral
    Given Olivia has submitted an application that was referred
    When Uma views the application
    Then the "Approve" action is unavailable because "REFERRAL_AUTHORITY"

  Scenario: An automated decline offers a human review
    Given Olivia has submitted an application that was declined
    When Olivia views the application
    Then the "Request human review" action is offered

  Scenario: An auditor cannot start a new application
    When Aled views the application queue
    Then the "New application" action is unavailable because "ROLE_NOT_PERMITTED"
