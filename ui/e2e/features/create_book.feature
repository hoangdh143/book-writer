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

  Scenario: Creating a book with a Wiro uncensored model and a saved key
    When the user opens settings
    And the user saves the Wiro API key "wiro-test"
    And the user reloads the page
    And the user writes the idea "A heist on a floating city"
    And the user selects the model "Qwen3.8 27B Uncensored"
    And the user clicks "Create book"
    Then the create request has model "qwen/qwen3-8-27b-uncensored" and base url "https://llm.wiro.ai/v1/chat/completions"
    And the create request has api key "wiro-test"

  Scenario: Settings saved before Wiro existed keep working
    Given the browser has settings saved with only an OpenRouter API key "sk-or-old"
    When the user writes the idea "A heist on a floating city"
    And the user selects the model "Qwen3.8 27B Uncensored"
    And the user clicks "Create book"
    Then the create request has model "qwen/qwen3-8-27b-uncensored" and base url "https://llm.wiro.ai/v1/chat/completions"

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
