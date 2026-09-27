@decline-notice
Feature: Decline notice
  As a declined customer
  I want a plain-language explanation of why I was declined
  So that I understand the decision and what I can do next

  Spec: §9; modelled on the FCA Consumer Duty and CCA 1974 s.157.

  Background:
    Given the current time is "2026-10-01T09:00:00Z"
    And the following staff members:
      | name   | role               |
      | Olivia | LOAN_OFFICER       |
      | Liam   | LOAN_OFFICER       |
      | Uma    | UNDERWRITER        |
      | Sam    | SENIOR_UNDERWRITER |
      | Aled   | AUDITOR            |

  Scenario: A decline based on credit reference data names the agency
    Given Olivia has submitted an application that was declined
    Then the decline notice gives the reasons:
      | code           | text                                                                   |
      | CREDIT_HISTORY | Information from a credit reference agency about your credit history. |
    And the decline notice names the credit reference agency "Fixture Credit Reference Agency Ltd"
    And the decline notice offers a human review

  Scenario: An affordability decline does not name an agency
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 800        |
      | net monthly income            | 3000.00    |
      | monthly credit commitments    | 750.00     |
      | essential monthly expenditure | 1200.00    |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 453.00
    Then the decline notice gives the reasons:
      | code              | text                                                                                 |
      | AFFORDABILITY_DSR | Your existing and proposed credit repayments are too high compared with your income. |
    And the decline notice does not name a credit reference agency
    And the decline notice offers a human review

  Scenario Outline: The notice never reveals "<internal detail>"
    Given an applicant with:
      | date of birth                 | 1991-03-15 |
      | credit reference score        | 800        |
      | net monthly income            | 3000.00    |
      | monthly credit commitments    | 750.00     |
      | essential monthly expenditure | 1200.00    |
    When Olivia submits an application for 10000.00 over 36 months with a monthly repayment of 453.00
    Then the decline notice does not contain "<internal detail>"

    Examples:
      | internal detail |
      | R03_DSR         |
      | 40.10           |
      | 35.00           |

  Scenario: A manual decline gives a general reason and keeps the underwriter's note internal
    Given Olivia has submitted an application that was referred
    And Sam has declined the application with the reason "Income evidence inconsistent"
    Then the decline notice gives the reasons:
      | code                 | text                                                                  |
      | UNDERWRITER_DECISION | An underwriter reviewed your application and was unable to approve it. |
    And the decline notice does not contain "Income evidence inconsistent"
    And the decline notice does not offer a human review
