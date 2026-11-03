# book-writer

Generate a complete, multi-chapter book from a single prompt — fiction or non-fiction — built on
[loki-engine](../loki-engine), a Scala-ZIO graph-native agent orchestration framework.

## How it works

The pipeline is a loki agent graph with four stages:

```
             user prompt
                 │
    ┌────────────▼────────────┐
    │  BookArchitect (Agent)  │  plans title, genre, premise and every chapter
    │  ├─ record_book_meta    │  via native tool calls (HAS_TOOL edges)
    │  └─ record_chapter ×N   │
    └────────────┬────────────┘
                 │ DELEGATES_TO
    ┌────────────▼────────────┐        ┌──────────────────────┐
    │ ChapterWriter (Agent)   │◄───────│ Craft guidelines     │
    │  writes each chapter    │        │ (HAS_CONTEXT node)   │
    └────────────┬────────────┘        └──────────────────────┘
                 │ DELEGATES_TO
    ┌────────────▼────────────┐
    │  BookEditor (Agent)     │  back-cover blurb + foreword via tools
    │  ├─ record_blurb        │
    │  └─ record_foreword     │
    └────────────┬────────────┘
                 │
        Assembler (pure code)  → book.md + outline.json + per-chapter files
```

- **Stage 1 — Planning.** The `BookArchitect` agent records the outline through structured tool
  calls (`record_book_meta`, one `record_chapter` per chapter), captured by the app and stored as
  the single source of truth for the whole run.
- **Stage 2 — Writing.** One shared `ChapterWriter` agent writes every chapter:
  - `--concurrency 1` (default): chapters are written **sequentially**; after each chapter its text
    is materialised with `GraphExecutor.materialiseOutput` and attached to the writer via a
    `HAS_CONTEXT` edge, so the engine's `ContextNavigator` injects all previous chapters verbatim
    into the next chapter's prompt — full character/name/event continuity.
  - `--concurrency N` (>1): chapters fan out concurrently through loki's `BatchExecutor`
    (checkpointed, failed chapters auto-retried with `resume`), with continuity provided by the
    chapter synopses.
- **Stage 3 — Editing.** The `BookEditor` agent reads the manuscript and records a back-cover
  blurb and a foreword via tool calls.
- **Stage 4 — Assembly.** Pure code stitches title page, blurb, foreword, table of contents and
  chapters into a single Markdown book.

## Requirements

- JDK 21+ (Java 11 works too), sbt (the launcher will fetch the pinned 1.9.9)
- An OpenAI-compatible chat-completions endpoint + API key (defaults to DeepSeek)

## Usage

```powershell
# PowerShell
$env:DEEPSEEK_API_KEY = "sk-..."
$env:BOOK_PROMPT = "A science fiction novella about the last lighthouse keeper on a flooded Earth"
sbt "run --chapters 6 --words 1200 --out output/my-book.md"
```

```bash
# Bash
export DEEPSEEK_API_KEY=sk-...
sbt 'run --prompt "A cozy mystery set in a lighthouse village" --chapters 4'
```

The prompt can be passed with `--prompt`, as a positional argument, or via the `BOOK_PROMPT`
environment variable. The API key comes from `--api-key`, `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`.

### Options

| Option | Default | Description |
|---|---|---|
| `--prompt <text>` | — | Book topic / idea / premise (or positional arg / `BOOK_PROMPT`) |
| `--chapters <n>` | 6 | Target number of chapters (1–30) |
| `--words <n>` | 1500 | Target words per chapter (200–5000) |
| `--out <path>` | `output/book.md` | Output Markdown file |
| `--concurrency <n>` | 1 | 1 = sequential with full continuity; >1 = parallel `BatchExecutor` |
| `--model <name>` | `deepseek-chat` | OpenAI-compatible model id |
| `--api-key <key>` | env | API key |
| `--base-url <url>` | DeepSeek | Chat-completions endpoint |
| `--temperature <t>` | 0.8 | Sampling temperature |
| `--no-editor` | off | Skip the editor stage (blurb + foreword) |
| `--debug` | off | Print stack traces on failure |

### Output

For `--out output/my-book.md` you get:

- `output/my-book.md` — the complete book (title page, blurb, foreword, TOC, chapters)
- `output/my-book-outline.json` — the machine-readable outline produced by the architect
- `output/my-book-chapters/ch-NN-<slug>.md` — each chapter as its own file

## Example

```powershell
$env:BOOK_PROMPT = "A mystery novel set in a remote alpine observatory where an astronomer discovers the star catalogue has been altered"
sbt "run --chapters 6 --words 1200 --out output/observatory.md"
```

produced *The Corrected Sky* — 8,657 words, 6 chapters, in about 2 minutes with `deepseek-chat`,
with character names, place names and events consistent across all chapters.

## Project layout

```
build.sbt                          depends on ../loki-engine (ProjectRef)
src/main/scala/bookwriter/
  Main.scala                       CLI entry, exit codes, token-escalation cap for 8k-output models
  Config.scala                     argument parsing + usage
  Prompts.scala                    system prompts for the three agents + style guide
  Outline.scala                    outline/editor data models, tool-call sinks
  BookGraph.scala                  builds the loki graph (agents, tools, context, delegation)
  Briefs.scala                     per-chapter / editor prompt assembly
  BookPipeline.scala               4-stage orchestration (sequential + batch modes, retries)
  Assembler.scala                  Markdown book + JSON outline + file output
  Json.scala                       minimal JSON writer for outline.json
```
