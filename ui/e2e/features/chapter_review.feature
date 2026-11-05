Feature: Chapter review gate
  Scenario: Approving a chapter with a comment
    Given a book with chapter 2 awaiting review is open
    When the user writes the review comment "Sharpen the ending"
    And the user clicks "Approve chapter"
    Then the chapter approve request has comment "Sharpen the ending"
    And the book enters generation

  Scenario: Approving the rest finishes all remaining chapters
    Given a book with chapter 2 awaiting review is open
    When the user clicks "Approve and write the rest"
    Then the approve-rest request has no comment
    And the book enters generation

  Scenario: A revision loads the updated chapter text
    Given a book with chapter 2 awaiting review is open
    When the user writes the review comment "More storm scenes"
    And the user clicks "Request revision"
    Then the chapter revise request has comment "More storm scenes"
    And the chapter text becomes "Storm-tossed rewrite of chapter two."

  Scenario: Chapter text is rendered as sanitised markdown
    Given a book with unsafe chapter text is open
    Then the chapter shows bold text "Bold claim" and rendered math
    And the chapter contains no injected markup
