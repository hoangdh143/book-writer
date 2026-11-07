Feature: Duplicating a completed book
  Scenario: A copy opens the form with the same idea and settings and waits for you
    Given a completed book using "meta-llama/llama-3.3-70b-instruct" at "https://openrouter.ai/api/v1/chat/completions" is open
    When the user clicks "Duplicate"
    Then the new book form reads "A heist on a floating city", "9" chapters of "2200" words, "3" at once
    And the page explains "Copied from"
    And no book has been created
    When the user clicks "Create book"
    Then the create request has idea "A heist on a floating city", 9 chapters of 2200 words, 3 at once, scholar and diagrams
    And the create request has model "meta-llama/llama-3.3-70b-instruct" and base url "https://openrouter.ai/api/v1/chat/completions"

  Scenario: A copy of a custom model keeps its id and URL
    Given a completed book using "my-model" at "https://llm.example.com/v1/chat/completions" is open
    When the user clicks "Duplicate"
    And the user clicks "Create book"
    Then the create request has model "my-model" and base url "https://llm.example.com/v1/chat/completions"

  Scenario: A preset name at another URL is treated as a custom model
    Given a completed book using "gpt-4o" at "https://llm.example.com/v1/chat/completions" is open
    When the user clicks "Duplicate"
    And the user clicks "Create book"
    Then the create request has model "gpt-4o" and base url "https://llm.example.com/v1/chat/completions"

  Scenario: A saved copy without settings falls back to the form's defaults
    Given a completed book is open
    When the user clicks "Duplicate"
    Then the new book form reads "The Lighthouse Mystery", "6" chapters of "1500" words, "1" at once

  Scenario: Only completed books offer it
    Given a book waiting for TOC review is open
    Then there is no "Duplicate" button
