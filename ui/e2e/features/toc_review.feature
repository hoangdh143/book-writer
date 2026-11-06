Feature: TOC review gate
  Scenario: Approving the TOC sends comment and edits
    Given a book waiting for TOC review is open
    When the user sets the outline title to "The Floating Heist"
    And the user writes the review comment "Tighten chapter two"
    And the user clicks "Approve and write all chapters"
    Then the TOC approve request has mode "all", comment "Tighten chapter two" and title "The Floating Heist"
    And the book enters generation

  Scenario: Revising the TOC requires a comment and returns a fresh outline
    Given a book waiting for TOC review is open
    Then the "Request revision" button is disabled
    When the user writes the review comment "Add a heist chapter"
    And the user clicks "Request revision"
    Then the TOC revise request has comment "Add a heist chapter"
    And a fresh outline arrives

  Scenario: Editing the outline warns that a revision discards the edits
    Given a book waiting for TOC review is open
    When the user sets the outline title to "The Floating Heist"
    Then the page explains "discards the edits"

  Scenario: The book idea is shown and an unchanged idea is not sent
    Given a book waiting for TOC review is open
    Then the idea still reads "The Lighthouse Mystery"
    When the user clicks "Approve and write all chapters"
    Then the TOC approve request has no idea
    And the book enters generation

  Scenario: Approving sends a changed book idea and keeps the outline
    Given a book waiting for TOC review is open
    When the user changes the book idea to "A heist on a floating city"
    Then the page explains "Approving keeps this outline as it is"
    When the user clicks "Approve and review each chapter"
    Then the TOC approve request has idea "A heist on a floating city"
    And the book enters generation

  Scenario: A changed book idea can replan the outline without feedback
    Given a book waiting for TOC review is open
    When the user changes the book idea to "A heist on a floating city"
    And the user clicks "Request revision"
    Then the TOC revise request has comment ""
    And the TOC revise request has idea "A heist on a floating city"
    And a fresh outline arrives
    And the idea still reads "A heist on a floating city"

  Scenario: A blank book idea blocks every decision
    Given a book waiting for TOC review is open
    When the user changes the book idea to "   "
    And the user writes the review comment "Add a heist chapter"
    Then the form shows the error "Describe your book idea"
    And the "Request revision" button is disabled
    And the "Approve and write all chapters" button is disabled
    And the "Approve and review each chapter" button is disabled
