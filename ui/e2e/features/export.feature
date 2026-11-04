Feature: Exporting a completed book
  Scenario: Downloading the markdown export
    Given a completed book is open
    When the user downloads the export in format "Markdown (.md)"
    Then the downloaded file is named "the-lighthouse-mystery.md"
    And the file contains "The fog rolled in"

  Scenario: Downloading the HTML export
    Given a completed book is open
    When the user downloads the export in format "HTML (.html)"
    Then the downloaded file is named "the-lighthouse-mystery.html"
    And the file contains "<h1>"

  Scenario: Downloading the plain text export
    Given a completed book is open
    When the user downloads the export in format "Plain text (.txt)"
    Then the downloaded file is named "the-lighthouse-mystery.txt"
    And the file does not contain "#"

  Scenario: Downloading the EPUB export
    Given a completed book is open
    When the user downloads the export in format "EPUB (.epub)"
    Then the downloaded file is named "the-lighthouse-mystery.epub"
    And the epub embeds non-empty katex fonts
