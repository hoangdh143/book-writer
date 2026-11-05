Feature: Deleting a book
  Scenario: Deleting asks for confirmation first
    Given a completed book is open
    When the user clicks "Delete"
    Then the book shows a completed view
    When the user clicks "Cancel"
    Then the book shows a completed view
    When the user clicks "Delete"
    And the user clicks "Delete book"
    Then the empty state is visible
    And the book list is empty
