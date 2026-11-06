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
    And the epub embeds a cover image

  Scenario: A cover uses the server's image settings when none are saved
    Given a completed book is open
    Then the generated cover is shown
    And the cover request carries no image settings

  Scenario: A failed cover can be retried with an image key and model from settings
    Given the server rejects the next cover with "no image API key"
    And a completed book is open
    Then the cover error says "no image API key"
    When the user opens settings
    And the user saves the cover image API key "sk-image-test"
    And the user selects the cover image model "GPT Image 2.6 Flare (faster)"
    And the user clicks "Done"
    And the user clicks "Try again"
    Then the generated cover is shown
    And the cover request has image key "sk-image-test" and model "gpt-image-2.6-flare"

  Scenario: Image settings survive a reload and clearing keeps the model
    Given a completed book is open
    When the user opens settings
    And the user saves the cover image API key "sk-image-test"
    And the user selects the cover image model "GPT Image 2.6 Flare (faster)"
    And the user reloads the page
    And the user opens settings
    Then the cover image API key shows "sk-image-test"
    And the cover image model shows "gpt-image-2.6-flare"
    When the user clicks "Clear saved keys"
    Then the cover image API key shows ""
    And the cover image model shows "gpt-image-2.6-flare"

  Scenario: A rendered diagram is shown and a remote image stays blocked
    Given a completed book with diagrams is open
    Then the manuscript shows the diagram and blocks the remote image
    And a diagram that was not rendered shows its source

  Scenario: The EPUB packages diagrams as files
    Given a completed book with diagrams is open
    When the user downloads the export in format "EPUB (.epub)"
    Then the epub packages the diagram as a file

  Scenario: Plain text leaves diagram images out
    Given a completed book with diagrams is open
    When the user downloads the export in format "Plain text (.txt)"
    Then the file has no image data
    And the file contains "Figure: Keeper route"
