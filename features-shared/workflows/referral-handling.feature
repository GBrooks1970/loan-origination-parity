@authority @referral
Feature: Referral handling
  As a head of credit
  I want referred applications decided only by senior underwriters
  So that borderline affordability cases get experienced judgement

  Spec: §6.2, §7.2 check 6. The referred fixture is 10000.00, within every approver's
  amount limit, so any refusal here is due to referral authority alone.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario Outline: <approver> may not decide a referred application
    Given Olivia has submitted an application that was referred
    When <approver> forces the "approve" command on the application
    Then the command is refused with reason "REFERRAL_AUTHORITY"
    And the application status is "REFERRED"

    Examples:
      | approver |
      | Liam     |
      | Uma      |

  Scenario: A senior underwriter approves a referred application
    Given Olivia has submitted an application that was referred
    When Sam approves the application
    Then the application status is "APPROVED"
    And the decision type is "MANUAL"
    And the application was decided by Sam

  Scenario: A senior underwriter declines a referred application
    Given Olivia has submitted an application that was referred
    When Sam declines the application with the reason "Income evidence inconsistent"
    Then the application status is "DECLINED"
    And the decision type is "MANUAL"
    And the decline reasons are "UNDERWRITER_DECISION"
