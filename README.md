# Guardrailed Ops Agent

A guardrailed ops CLI agent that takes a plain-English request like "delete the auth-service deployment in prod," translates it into a real `kubectl` command, checks a mock cluster state to figure out the blast radius, and either auto-runs safe commands or blocks destructive ones behind a confirmation screen that explains exactly what would break.

## The Gap

Existing NL-to-CLI tools (Claude Code, Warp, etc.) translate natural language into shell commands confidently, but they execute immediately without checking what a destructive command would actually affect. There's no blast-radius check between "here's the command" and "here's what happens if you run it."

## How It Works

1. You type a plain-English request into the terminal-style UI.
2. The backend translates it into a structured `kubectl` command and classifies whether it's destructive.
3. The frontend looks up the target resource in a mock cluster state to compute how many pods/resources would be affected.
4. Safe commands auto-run and show fake output. Destructive commands are blocked behind a red warning card (command, namespace, affected pods, "irreversible" label) until you explicitly confirm.

## Project Structure

```
ops-agent/
├── backend/          → NL-to-kubectl translation + risk classification (Person A)
│   ├── translate.js
│   ├── server.js
│   ├── test.js
│   ├── package.json
│   └── .env.example
├── frontend/         → Terminal UI, mock cluster state, blast-radius lookup (Person B)
│   ├── index.html
│   ├── script.js
│   ├── mock-data/
│   │   ├── stub-responses.json
│   │   └── cluster-state.json
│   └── package.json
├── docs/
│   └── pitch-deck.pdf
└── README.md
```

## Setup

1. Clone this repo:
   ```
   git clone https://github.com/NekhilSivakumar/Ops-Agent.git
   cd Ops-Agent
   ```
2. Set up the backend:
   ```
   cd backend
   npm install
   cp .env.example .env   # add your API key
   npm start
   ```
3. Set up the frontend:
   ```
   cd ../frontend
   ```
   Open `index.html` with VS Code's Live Server extension (right-click → "Open with Live Server"). It needs to run through a local server, not by double-clicking the file, since it fetches local JSON files.

## Usage

Try these example prompts in the input box:

- `show me pods in staging` → safe, auto-runs, shows fake output
- `delete the auth-service deployment in prod` → blocked, shows blast-radius warning card
- `delete the payments-service deployment in prod` → blocked, higher pod count in the warning

## Demo Video

[link]

## Team

- **Person A** — Nekhil Sivakumar's teammate — NL translation, risk classification, backend server
- **Person B** — Nekhil Sivakumar — mock cluster state, UI, blast-radius lookup, integration
