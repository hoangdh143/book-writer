Feature: TOC review gate
  Scenario: Approving the TOC sends comment and edits
    Given a book waiting for TOC review is open
    When the user sets the outline title to "The Floating Heist"
    And the user writes the review comment "Tighten chapter two"
    And the user clicks "Approve — all chapters"
    Then the TOC approve request has mode "all", comment "Tighten chapter two" and title "The Floating Heist"
    And the book enters generation

  Scenario: Revising the TOC requires a comment and returns a fresh outline
    Given a book waiting for TOC review is open
    Then the "Request revision" button is disabled
    When the user writes the review comment "Add a heist chapter"
    And the user clicks "Request revision"
    Then the TOC revise request has comment "Add a heist chapter"
    And a fresh outline arrives
