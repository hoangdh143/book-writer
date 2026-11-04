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

  Scenario: A custom model requires a model id
    When the user selects the model "Custom model…"
    And the user clicks "Create book"
    Then the form shows the error "Model id required"

  Scenario: A server rejection is reported as a toast
    Given the server rejects book creation with "no API key: pass apiKey or set DEEPSEEK_API_KEY"
    When the user writes the idea "A quiet ghost story"
    And the user clicks "Create book"
    Then an error toast contains "no API key"
