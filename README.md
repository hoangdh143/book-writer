# book-writer

Generate a complete, multi-chapter book from a single prompt — fiction or non-fiction — or, in
**scholar mode**, a cited, fact-checked, peer-reviewed research paper — built on
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

## Scholar mode

Pass `--scholar` (CLI) or toggle **Scholar mode** in the web UI to produce a research paper
instead of a book. The graph gains three agents and the pipeline becomes:

```
  1/5  ResearchArchitect  plans title, field, abstract and section outline
  2/5  Bibliographer      compiles a numbered reference list (record_reference ×N)
  3/5  SectionWriter      writes each section with inline [n] citations
       FactChecker        cross-checks every claim against the references
                          (record_finding); sections with major findings are
                          automatically repaired and re-checked
  4/5  PeerReviewer       reviews the finished paper: score, verdict and
                          per-section issues (record_review); sections flagged
                          with major issues get one revision round + re-review
  5/5  Assembler          paper.md (abstract, sections, References) + a scholar
                          report (fact-check table + review) + references.json
```

Citation policy: the writer may only cite numbers from the Bibliographer's list; unsupported or
contradicted claims are flagged by the FactChecker and either repaired, hedged or removed before
the paper is assembled. Note that references come from the model and should still be verified
before you rely on them.

### Scholar output

For `--out output/paper.md` you additionally get:

- `output/paper-references.json` — the machine-readable bibliography
- `output/paper-scholar-report.md` — fact-check findings table + peer-review verdict and issues
- `paper.md` itself ends with **References** and appendices A (fact-check) and B (peer review)

```powershell
$env:DEEPSEEK_API_KEY = "sk-..."
sbt "run --scholar \"The impact of transformer architectures on low-resource machine translation\" --chapters 6"
```

## Requirements

- JDK 21+ (Java 11 works too), sbt (the launcher will fetch the pinned 1.9.9)
- An OpenAI-compatible chat-completions endpoint + API key (defaults to DeepSeek)

## Run with Docker

Builds the UI and the server into one image and serves both on one port. Docker is the only
requirement, but `loki-engine` must be checked out next to this repository (`../loki-engine`).

```powershell
docker compose up --build -d    # then open http://localhost:8090
```

- **API keys:** add them in the app's Settings, or put `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` in a
  `.env` file beside `compose.yaml`.
- **Port:** set `PORT` in `.env` to use something other than 8090.
- **Books:** stored in the `book-writer-output` Docker volume, so they survive rebuilds. `docker
  compose down -v` deletes them. Session files in this volume include the API key used for each book.
- **LM Studio:** reached on the host through `host.docker.internal:1234`. Set `LM_STUDIO_BASE_URL`
  to use a different address.
- **Running several books:** the server can generate any number of books at once. **Concurrent LLM calls**
  in the app's Settings (1–100, default 4) limits the calls in flight across all of them, and further calls
  queue for a free slot. A change applies right away and is saved in `output/settings.json`. Lower it if your
  provider returns rate-limit errors. `LLM_MAX_CONCURRENCY` sets the starting value until one is saved in
  Settings, which then takes priority. The CLI is not limited by this setting.
- **Cover images:** every EPUB export gets an AI-generated cover based on the book's outline. It is
  generated once per book through an OpenAI-compatible images/generations endpoint
  (`IMAGE_BASE_URL`, default OpenAI's) with model `IMAGE_MODEL` (default `gpt-image-2.6-sunburst`) and key from
  `IMAGE_API_KEY` (falls back to `OPENAI_API_KEY`). Settings in the web UI can set the key and model
  instead; they stay in the browser and win over the server's values. Without a key the book still
  exports, just without a cover.
- **Exposure:** the port is published on localhost only, because the app has no login. Anyone who
  can reach it can read your books and spend the server's API key, so put an authenticating
  reverse proxy in front of it before exposing it to a network.

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
| `--concurrency <n>` | 1 | 1 = sequential with full continuity; >1 = parallel `BatchExecutor` (CLI only; the server rejects values above 1) |
| `--model <name>` | `deepseek-chat` | OpenAI-compatible model id |
| `--api-key <key>` | env | API key |
| `--base-url <url>` | DeepSeek | Chat-completions endpoint |
| `--temperature <t>` | 0.8 | Sampling temperature |
| `--no-editor` | off | Skip the editor stage (blurb + foreword) |
| `--scholar` | off | Scholar mode: research paper with bibliography, citations, fact cross-checking and peer review |
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
  Prompts.scala                    system prompts for all agents + style guide
  Outline.scala                    outline/editor data models, tool-call sinks
  Scholar.scala                    references, findings, review models + scholar tool-call sinks
  BookGraph.scala                  builds the loki graph (agents, tools, context, delegation)
  Briefs.scala                     per-chapter / editor / scholar prompt assembly
  BookPipeline.scala               orchestration (sequential + batch modes, retries, scholar run)
  Assembler.scala                  Markdown book/paper + JSON outline + file output
  Json.scala                       minimal JSON writer for outline.json
```
