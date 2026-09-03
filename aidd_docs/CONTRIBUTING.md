# Contributing to this project's AI context

How to add or change the context the AI relies on here. For authoring AIDD skills, agents, rules, and templates, see the framework guide: <https://github.com/ai-driven-dev/framework/blob/main/CONTRIBUTING.md>.

## Changing project memory

Add or edit a file under `aidd_docs/memory/`. See [`memory/README.md`](memory/README.md) for what belongs there and how it loads.

After adding or removing a file, re-run the memory sync so the `<aidd_project_memory>` block in `CLAUDE.md` matches. Never edit that block by hand.

## Adding AI content (skills, rules, agents, commands, hooks)

- Use the generator skills (`aidd-context:04-skill-generate` through `08-hook-generate`, and `10-learn` for memory or rules). They scaffold the right shape and write to the right place for each tool you use.
- This is a solo repo with no pull requests, and `git-sync` pushes `main` automatically. There is no review gate, so re-read anything that changes how the AI behaves before it goes quiet in the tree.

## House conventions

- One file per concern, named after the concern (`database.md`, `auth.md`), flat at the root of `memory/`. No nesting, no consolidating two concerns into one file.
- A fact lives in exactly one file. If it belongs somewhere else, move it and reference it — never restate it.
- Memory versus rule versus doc: memory is what the AI needs to *know* about this project (stack, decisions, gotchas). `GUIDELINES.md` is how the AI must *behave* here. `DESIGN_GUIDELINES.md` and `README.md` at the repo root are for the human and stay as they are.
- Claude Code is the only configured tool. Adding another means running the memory sync for its context file too, not copying `CLAUDE.md` by hand.
- Current state only. No TODOs, no plans, no personal notes.
