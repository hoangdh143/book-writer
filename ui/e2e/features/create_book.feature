Feature: Create a new book
  Background:
    Given the book API is mocked

  Scenario: Creating a book with an OpenRouter model
    When the user writes the idea "A heist on a floating city"
    And the user sets chapters to 3 and words per chapter to 500
    And the user selects the model "Llama 3.3 70B Instruct"
    And the user clicks "Create book"
    Then the create request has model "meta-llama/llama-3.3-70b-instruct" and base url "https://openrouter.ai/api/v1/chat/completions"
    And the book appears in the list
    And the panel shows a planning book

  Scenario: Creating a book with a local LM Studio model
    When the user writes the idea "A heist on a floating city"
    And the user selects the model "qwen2.5-7b-instruct"
    And the user clicks "Create book"
    Then the create request has model "qwen2.5-7b-instruct" and base url "http://localhost:1234/v1/chat/completions"

  Scenario: A half-written idea survives a look at another book
    Given the book API lists a completed book
    When the user writes the idea "A heist on a floating city"
    And the user opens the completed book
    And the user clicks "New book"
    Then the idea still reads "A heist on a floating city"

  Scenario: A missing saved key points to settings
    When the user selects the model "Llama 3.3 70B Instruct"
    And the user clicks "Add one"
    Then the settings dialog is open

  Scenario: Concurrent LLM calls can be changed in settings
    When the user opens settings
    Then concurrent LLM calls shows 4
    When the user sets concurrent LLM calls to "8"
    And the user saves concurrent LLM calls
    Then the server saved concurrent LLM calls as 8
    And the settings dialog says "Saved."
    When the user reloads the page
    And the user opens settings
    Then concurrent LLM calls shows 8

  Scenario Outline: An out-of-range concurrent LLM calls value cannot be saved
    When the user opens settings
    And the user sets concurrent LLM calls to "<value>"
    Then saving concurrent LLM calls is disabled
    And the settings dialog says "Enter a whole number from 1 to 100."

    Examples:
      | value |
      | 0     |
      | 101   |
      | 2.5   |

  Scenario: A failed concurrent LLM calls save is shown in the dialog
    Given the server rejects saving settings with "could not save settings"
    When the user opens settings
    And the user sets concurrent LLM calls to "8"
    And the user saves concurrent LLM calls
    Then the settings dialog says "could not save settings"

  Scenario: The settings dialog only closes on purpose
    When the user opens settings
    And the user clicks inside the settings dialog
    Then the settings dialog is open
    When the user presses Escape
    Then the settings dialog is closed

  Scenario: A custom model requires a model id
    When the user selects the model "Custom model…"
    And the user clicks "Create book"
    Then the form shows the error "Model id required"

  Scenario: A server rejection is reported as a toast
    Given the server rejects book creation with "no API key: pass apiKey or set DEEPSEEK_API_KEY"
    When the user writes the idea "A quiet ghost story"
    And the user clicks "Create book"
    Then an error toast contains "no API key"

  Scenario: A locally saved API key is used for creating books
    When the user opens settings
    And the user saves the OpenRouter API key "sk-or-test"
    And the user reloads the page
    And the user writes the idea "A heist on a floating city"
    And the user selects the model "Llama 3.3 70B Instruct"
    And the user clicks "Create book"
    Then the create request has api key "sk-or-test"
