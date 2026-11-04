Feature: Error handling
  Scenario: A failing book detail shows a retry panel
    Given the book detail endpoint fails
    When a book is selected
    Then the error panel "Could not load the book" is visible
    When the user retries after the endpoint recovers
    Then the book renders normally

  Scenario: A missing book offers a way back
    Given the book detail endpoint returns not found
    When a book is selected
    Then the error panel "Book not found" is visible
    When the user clicks "Back to books"
    Then the empty state is visible

  Scenario: An unknown status falls back gracefully
    Given the book reports status "hyperdrive"
    When the book is open
    Then the fallback shows "Unknown status “hyperdrive”."

  Scenario: An unreachable server explains what to do
    Given the book endpoint is offline
    When a book is selected
    Then the error panel "Cannot reach the server" is visible
    And the error explains "run --serve"
    When the endpoint comes back
    Then the book renders normally

  Scenario: A completed book stays downloadable while the server is offline
    Given a completed book is open
    When the server goes offline
    And the user reloads the page
    Then the saved-copy banner is visible
    And the book shows a completed view
    When the user downloads the export in format "Markdown (.md)"
    Then the downloaded file is named "the-lighthouse-mystery.md"
    And the file contains "The fog rolled in"