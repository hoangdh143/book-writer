Feature: Illustrations
  Scenario: Illustrations are off unless ticked
    Given the book API is mocked
    When the user writes the idea "A guide to bread"
    Then the form has no "Image model" field
    When the user clicks "Create book"
    Then the create request has no illustrations

  Scenario: Models come from OpenRouter, without the vector ones
    Given the book API is mocked
    When the user turns on illustrations
    Then the image model options are "Google: Nano Banana 2.1, Meta: Muse Image, OpenAI: GPT Image 2.6 Flare"
    And "Image model" reads "google/gemini-nano-banana-2.1"
    And "Aspect ratio" reads "3:2"
    And "Resolution" reads "2K"
    And the form has no "Quality" field

  Scenario: The options follow what the chosen model supports
    Given the book API is mocked
    When the user turns on illustrations
    And the user selects the image model "OpenAI: GPT Image 2.6 Flare"
    Then "Aspect ratio" offers "Model default, 1:1, 2:3, auto"
    And "Quality" offers "Model default, auto, low, high"
    And the form has no "Resolution" field
    When the user selects the image model "Meta: Muse Image"
    Then the form has no "Aspect ratio" field
    And the form has no "Quality" field
    And the form has no "Resolution" field

  Scenario: The chosen settings and saved key are sent with the book
    Given the book API is mocked
    When the user saves the OpenRouter key "sk-or-test"
    And the user writes the idea "A guide to bread"
    And the user turns on illustrations
    And the user sets "Aspect ratio" to "16:9"
    And the user sets "Resolution" to "4K"
    And the user sets "Illustrations per chapter (at most)" to "3"
    And the user sets "Illustration style (optional)" to "Soft watercolour"
    And the user clicks "Create book"
    Then the create request has illustrations '{"aspectRatio":"16:9","resolution":"4K","useReference":true,"model":"google/gemini-nano-banana-2.1","perChapter":3,"style":"Soft watercolour","apiKey":"sk-or-test"}'

  Scenario: A setting the new model lacks is not sent, and comes back with the old model
    Given the book API is mocked
    When the user writes the idea "A guide to bread"
    And the user turns on illustrations
    And the user selects the image model "OpenAI: GPT Image 2.6 Flare"
    And the user selects the image model "Google: Nano Banana 2.1"
    Then "Aspect ratio" reads "3:2"
    When the user selects the image model "Meta: Muse Image"
    And the user clicks "Create book"
    Then the create request has illustrations '{"useReference":false,"model":"meta/muse-image","perChapter":1}'

  Scenario: Many illustrations per chapter can be chosen
    Given the book API is mocked
    When the user writes the idea "A guide to bread"
    And the user turns on illustrations
    And the user sets "Illustrations per chapter (at most)" to "25"
    And the user clicks "Create book"
    Then the create request has illustrations '{"aspectRatio":"3:2","resolution":"2K","useReference":true,"model":"google/gemini-nano-banana-2.1","perChapter":25}'

  Scenario Outline: An invalid number per chapter is refused
    Given the book API is mocked
    When the user writes the idea "A guide to bread"
    And the user turns on illustrations
    And the user sets "Illustrations per chapter (at most)" to "<value>"
    And the user clicks "Create book"
    Then the form shows the error "Choose a whole number of illustrations per chapter, at least 1"
    And no book was created

    Examples:
      | value |
      | 0     |
      | -2    |
      | 1.5   |

  Scenario: The book can still be created when the model list is unavailable
    Given OpenRouter image models cannot be loaded
    And the book API is mocked
    When the user writes the idea "A guide to bread"
    And the user turns on illustrations
    Then the page explains "Could not load image models"
    And the form has no "Aspect ratio" field
    When the user clicks "Create book"
    Then the create request has illustrations '{"useReference":false,"model":"google/gemini-nano-banana-2.1","perChapter":1}'

  Scenario: A duplicate keeps the illustration settings
    Given a completed illustrated book is open
    When the user clicks "Duplicate"
    Then "Image model" reads "openai/gpt-image-2.6-flare"
    And "Aspect ratio" reads "2:3"
    And "Quality" reads "high"
    And "Illustrations per chapter (at most)" reads "2"
    And "Illustration style (optional)" reads "Soft watercolour"

  Scenario: A large JPEG illustration shows, and stays out of browser storage
    Given a completed book with a large illustration is open
    Then the manuscript shows the illustration
    And the saved copy leaves the large image out

  Scenario: The EPUB packages an illustration as a file
    Given a completed book with a large illustration is open
    When the user downloads the export in format "EPUB (.epub)"
    Then the epub packages the illustration as a JPEG
