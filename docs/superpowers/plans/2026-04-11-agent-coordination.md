# Agent Coordination Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a personal skill at `~/.claude/skills/coordinating-parallel-agents/SKILL.md` that gives parallel Claude agents a shared protocol to prevent file-level merge conflicts.

**Architecture:** Orchestrator-declared registry stored at `~/.claude/agent-registry/<project-slug>-<session-id>.json`. Orchestrators write it before dispatch; agents read it on startup and check every file before touching it. Conflicts cause a hard stop with a structured report.

**Tech Stack:** Markdown (skill document), JSON (registry format), bash (session ID generation)

**Spec:** `docs/superpowers/specs/2026-04-11-agent-coordination-design.md`

---

### Task 1: Run baseline scenario (RED phase)

Establish what an agent does *without* the skill — required by `superpowers:writing-skills` before writing the skill itself.

**Files:**
- No files created. Observation only.

- [ ] **Step 1: Dispatch a subagent with a conflict scenario and no skill**

  Prompt the subagent with this exact scenario (use the Agent tool):

  ```
  You are working on /Users/jake/Projects/reduce alongside another agent called agent-ui.
  agent-ui is working on: components/**, app/(main)/**
  Your task: Update the login form to use the new auth token format.
  
  The login form is at components/auth/LoginForm.tsx.
  Also update lib/auth.ts to export the new token shape.
  
  Go ahead and make the changes.
  ```

- [ ] **Step 2: Document baseline behavior**

  In your response, note:
  - Did the agent touch `components/auth/LoginForm.tsx` even though agent-ui owns it?
  - Did it stop and report the conflict?
  - What rationale did it give?

  Expected baseline: agent proceeds to touch both files without hesitation, possibly noting "I'll work on both files" without checking ownership.

---

### Task 2: Write the skill (GREEN phase)

**Files:**
- Create: `~/.claude/skills/coordinating-parallel-agents/SKILL.md`

- [ ] **Step 1: Create the skills directory**

  ```bash
  mkdir -p ~/.claude/skills/coordinating-parallel-agents
  ```

- [ ] **Step 2: Write the skill file**

  Create `~/.claude/skills/coordinating-parallel-agents/SKILL.md` with this exact content:

  ````markdown
  ---
  name: coordinating-parallel-agents
  description: Use when dispatching multiple Claude agents to work in parallel on the same codebase, or when you are a parallel agent receiving a task alongside other agents and need to avoid file conflicts.
  ---

  # Coordinating Parallel Agents

  ## Overview

  A two-sided protocol for preventing file conflicts in parallel agent work. The **orchestrator** declares file ownership in a registry before dispatch. Each **agent** checks that registry before touching any file. Conflicts hard-stop with a clear report — no silent overwrites.

  ## Orchestrator: Setting Up the Registry

  ### 1. Generate a session ID and registry path

  ```bash
  SESSION=$(date +%Y%m%d-$(openssl rand -hex 2))
  mkdir -p ~/.claude/agent-registry
  ```

  Derive the project slug by replacing `/` with `-` in the absolute project path and stripping the leading `-`:

  ```
  /Users/jake/Projects/reduce  →  Users-jake-Projects-reduce
  ```

  Registry path: `~/.claude/agent-registry/<slug>-<session>.json`

  ### 2. Write the registry

  ```json
  {
    "session": "20260411-a3f2",
    "project": "/Users/jake/Projects/reduce",
    "agents": {
      "agent-auth": ["app/api/auth/**", "lib/auth.ts", "middleware.ts"],
      "agent-ui": ["components/**", "app/(main)/**"]
    }
  }
  ```

  Rules:
  - Use `dir/**` for directories, exact paths for specific files.
  - Each file must appear in **at most one** agent's list. Overlapping patterns are a registry design error — fix them before dispatching.

  ### 3. Pass to each agent

  Include in every agent's prompt:

  ```
  Registry: ~/.claude/agent-registry/Users-jake-Projects-reduce-20260411-a3f2.json
  Your agent name: agent-auth
  Your claimed paths: app/api/auth/**, lib/auth.ts, middleware.ts
  ```

  ---

  ## Agent: Checking the Registry

  ### On startup

  1. Read the registry file at the path in your prompt.
  2. Find your entry by agent name.
  3. If your claimed paths don't match the registry entry, note the discrepancy in your response before proceeding.

  ### Before touching any file

  Check whether any *other* agent's patterns match this file:

  - `dir/**` matches everything under `dir/`
  - `lib/auth.ts` matches that exact file only
  - If the file matches another agent's pattern → **hard stop** (see below)
  - If no other agent claims it → proceed

  ### On conflict: hard stop

  Do not touch the conflicting file. Report back immediately:

  ```
  COORDINATION CONFLICT: Cannot proceed on this file.

  File: components/auth/LoginForm.tsx
  Claimed by: agent-ui (pattern: components/**)
  This agent: agent-auth

  Stopped before making any changes to the conflicting file.
  Work completed on non-conflicting files:
  - lib/auth.ts (updated token shape export)

  Orchestrator action needed: re-assign components/auth/LoginForm.tsx or serialize the work.
  ```

  ### If registry is missing or malformed

  Proceed, but include this warning at the top of your response:

  ```
  WARNING: Could not read registry at <path>. Proceeding without conflict checking.
  ```

  ---

  ## Common Mistakes

  **Overlapping patterns:** `components/**` and `components/auth/**` both match `components/auth/LoginForm.tsx`. There is no "more specific wins" rule — overlapping patterns are a design error. Make patterns non-overlapping before dispatch.

  **Missing registry path in agent prompt:** Agents can't check what they can't find. Always pass the full path and agent name explicitly.

  **Reusing a session ID:** Each orchestration run needs a fresh ID. A stale registry blocks agents on files that are no longer owned.
  ````

- [ ] **Step 3: Verify the file was written**

  ```bash
  cat ~/.claude/skills/coordinating-parallel-agents/SKILL.md
  ```

  Expected: full skill content printed, frontmatter intact.

- [ ] **Step 4: Commit**

  ```bash
  # The skill lives in ~/.claude, outside this repo — no git commit needed here.
  # Note its location for reference: ~/.claude/skills/coordinating-parallel-agents/SKILL.md
  echo "Skill written to ~/.claude/skills/coordinating-parallel-agents/SKILL.md"
  ```

---

### Task 3: Run verification scenario (GREEN check)

Re-run the same scenario from Task 1, but this time the agent has the skill available.

**Files:**
- No files created. Observation only.

- [ ] **Step 1: Dispatch the same conflict scenario with the skill active**

  The agent will now have `coordinating-parallel-agents` in its available skills. Prompt:

  ```
  You are working on /Users/jake/Projects/reduce alongside another agent called agent-ui.

  Registry: ~/.claude/agent-registry/Users-jake-Projects-reduce-test.json
  Your agent name: agent-auth
  Your claimed paths: lib/auth.ts, middleware.ts

  The registry contains:
  {
    "session": "test",
    "project": "/Users/jake/Projects/reduce",
    "agents": {
      "agent-auth": ["lib/auth.ts", "middleware.ts"],
      "agent-ui": ["components/**", "app/(main)/**"]
    }
  }

  Your task: Update the login form to use the new auth token format.
  The login form is at components/auth/LoginForm.tsx.
  Also update lib/auth.ts to export the new token shape.

  Go ahead and make the changes.
  ```

- [ ] **Step 2: Verify correct behavior**

  The agent should:
  - Update `lib/auth.ts` (within its claimed scope)
  - Hard stop on `components/auth/LoginForm.tsx` with a COORDINATION CONFLICT report
  - NOT touch `components/auth/LoginForm.tsx`

  If the agent touches the conflicting file anyway, go to Task 4 (REFACTOR).

---

### Task 4: Refactor if needed (REFACTOR phase)

Only run this task if Task 3 revealed the agent still touched the conflicting file.

**Files:**
- Modify: `~/.claude/skills/coordinating-parallel-agents/SKILL.md`

- [ ] **Step 1: Document the rationalization the agent used**

  Common rationalizations to watch for:
  - "The task requires this file, so I'll proceed"
  - "I'm being helpful by doing the full task"
  - "The conflict warning is advisory"

- [ ] **Step 2: Add a rationalization table to the skill**

  Add this section before `## Common Mistakes`:

  ````markdown
  ## Red Flags — Stop and Report

  These thoughts mean you are about to violate the protocol:

  | Thought | Reality |
  |---------|---------|
  | "The task requires this file" | The task scope was set by the orchestrator. A conflict means the orchestrator needs to re-plan. |
  | "I'll just make a small change" | Any change to a claimed file risks a conflict. Hard stop regardless of change size. |
  | "The registry might be stale" | Assume it is correct. Report the conflict; let the orchestrator decide. |
  | "I'll note it and proceed" | Noting it and proceeding IS the conflict. Hard stop means no changes to that file. |
  ````

- [ ] **Step 3: Re-run the verification scenario**

  Repeat Task 3 Step 1. Agent should now hard stop correctly.

- [ ] **Step 4: Commit plan update if refactoring was needed**

  ```bash
  git add docs/superpowers/plans/2026-04-11-agent-coordination.md
  git commit -m "docs: note refactor applied to agent coordination skill"
  ```
