@human-review
Feature: Human review of automated declines
  As a customer who was declined by an automated decision
  I want to ask for a person to review it
  So that I am not refused credit solely by an algorithm

  Spec: §6.2–6.3; modelled on UK GDPR Article 22. Staff record the request on the
  customer's behalf. The 30-day window is inclusive. The fixture decline is at 2026-10-01T09:00:00Z.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario Outline: A request at <time> reopens the application for a senior underwriter
    Given Olivia has submitted an application that was declined
    And the current time is "<time>"
    When Olivia requests a human review of the application
    Then the application status is "REFERRED"
    And the audit trail records a human review request by Olivia

    Examples:
      | time                 |
      | 2026-10-15T09:00:00Z |
      | 2026-10-31T09:00:00Z |

  Scenario: A request after 30 days is refused
    Given Olivia has submitted an application that was declined
    And the current time is "2026-10-31T09:00:01Z"
    When Olivia forces the "request human review" command on the application
    Then the command is refused with reason "REVIEW_WINDOW_CLOSED"
    And the application status is "DECLINED"

  Scenario: A decision already taken by a person cannot be put to human review
    Given Olivia has submitted an application that was referred
    And Sam has declined the application with the reason "Income evidence inconsistent"
    When Olivia forces the "request human review" command on the application
    Then the command is refused with reason "REVIEW_NOT_AVAILABLE"

  Scenario: A reviewed application can then be approved
    Given Olivia has submitted an application that was declined
    And Olivia has requested a human review of the application
    When Sam approves the application
    Then the application status is "APPROVED"
    And the decision type is "MANUAL"
