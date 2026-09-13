// ---------------------------------------------------------
// Guardrailed Ops Agent — Person B (UI + blast radius + wiring)
// ---------------------------------------------------------

const historyEl = document.getElementById("history");
const inputEl = document.getElementById("command-input");
const sendBtn = document.getElementById("send-btn");

let clusterState = null;
let stubResponses = [];

// Load the two mock JSON files. Needs to be served over http (e.g. VS Code
// Live Server) — fetch() of local files fails if you just double-click index.html.
async function loadMockData() {
  const [clusterRes, stubRes] = await Promise.all([
    fetch("mock-data/cluster-state.json"),
    fetch("mock-data/stub-responses.json"),
  ]);
  clusterState = await clusterRes.json();
  stubResponses = await stubRes.json();
}

// ---------------------------------------------------------
// INTEGRATION SEAM
// This is the ONE function to swap when Person A's real LLM call is ready.
// It must keep returning an object in the same shape as the JSON contract:
// { original_input, command, resource_type, resource_name, namespace,
//   is_destructive, risk_reason }
// ---------------------------------------------------------
async function getTranslation(userInput) {
  // TODO: swap this stub lookup for Person A's real function, e.g.:
  // return await callPersonATranslationAPI(userInput);

  const lower = userInput.toLowerCase();
  const match = stubResponses.find((r) =>
    lower.includes(r.resource_name.toLowerCase()) &&
    lower.includes(r.namespace.toLowerCase())
  );
  if (match) return match;

  // Fallback for anything typed that doesn't match a stub example.
  return {
    original_input: userInput,
    command: `kubectl get pods -n default`,
    resource_type: "pod",
    resource_name: "*",
    namespace: "default",
    is_destructive: false,
    risk_reason: "No matching stub — defaulted to a safe read-only command",
  };
}

// Person B's job: given a translation result, look up blast radius info
// from the mock cluster state.
function getBlastRadius(translation) {
  const { resource_type, resource_name, namespace } = translation;

  let affected_pod_count = 0;
  const nsData = clusterState.namespaces[namespace];
  if (nsData && resource_type === "deployment") {
    const dep = nsData.deployments[resource_name];
    if (dep) affected_pod_count = dep.pods;
  }

  const is_prod = namespace === "prod";

  // Hardcoded reversibility per action type, as suggested in the handoff guide.
  const command = translation.command.toLowerCase();
  let reversible = true;
  if (command.includes("delete")) reversible = false;
  else if (command.includes("scale") || command.includes("restart")) reversible = true;

  return { affected_pod_count, is_prod, reversible };
}

// ---------------------------------------------------------
// UI rendering
// ---------------------------------------------------------

function scrollToBottom() {
  historyEl.scrollTop = historyEl.scrollHeight;
}

async function handleSubmit() {
  const userInput = inputEl.value.trim();
  if (!userInput) return;
  inputEl.value = "";
  sendBtn.disabled = true;

  const entry = document.createElement("div");
  entry.className = "entry";
  entry.innerHTML = `
    <div class="prompt-line">&gt; ${escapeHtml(userInput)}</div>
    <div class="translating">translating...</div>
  `;
  historyEl.appendChild(entry);
  scrollToBottom();

  const translation = await getTranslation(userInput);

  const translatingLine = entry.querySelector(".translating");
  translatingLine.remove();

  const commandLine = document.createElement("div");
  commandLine.className = "command-line";
  commandLine.textContent = `$ ${translation.command}`;
  entry.appendChild(commandLine);

  if (!translation.is_destructive) {
    const output = document.createElement("div");
    output.className = "safe-output";
    output.textContent = fakeSafeOutput(translation);
    entry.appendChild(output);
    sendBtn.disabled = false;
    scrollToBottom();
    return;
  }

  // Destructive path: show blast-radius warning card, gated by Confirm.
  const blast = getBlastRadius(translation);

  const card = document.createElement("div");
  card.className = "warning-card";
  card.innerHTML = `
    <div class="title">⚠ Destructive command detected</div>
    <div class="row"><strong>Command:</strong> ${escapeHtml(translation.command)}</div>
    <div class="row"><strong>Namespace:</strong> ${escapeHtml(translation.namespace)}${blast.is_prod ? " (production)" : ""}</div>
    <div class="row"><strong>Affected pods:</strong> ${blast.affected_pod_count}</div>
    <div class="row"><strong>Why:</strong> ${escapeHtml(translation.risk_reason)}</div>
    ${!blast.reversible ? '<div class="irreversible">This action is irreversible.</div>' : ""}
    <button type="button">Confirm</button>
  `;
  entry.appendChild(card);
  scrollToBottom();

  const confirmBtn = card.querySelector("button");
  confirmBtn.addEventListener("click", () => {
    confirmBtn.remove();
    const output = document.createElement("div");
    output.className = "confirmed-output";
    output.textContent = fakeDestructiveOutput(translation);
    card.appendChild(output);
    sendBtn.disabled = false;
    scrollToBottom();
  });

  // Note: sendBtn stays disabled until Confirm is clicked, so the user
  // can't queue up another command while a destructive one is pending.
}

function fakeSafeOutput(translation) {
  if (translation.command.includes("get pods")) {
    return (
      "NAME                          READY   STATUS    RESTARTS   AGE\n" +
      "auth-service-7d8f9c-abc12     1/1     Running   0          3d\n" +
      "auth-service-7d8f9c-def34     1/1     Running   0          3d"
    );
  }
  return "Command executed successfully.";
}

function fakeDestructiveOutput(translation) {
  return `deployment.apps "${translation.resource_name}" deleted`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------
// Wiring
// ---------------------------------------------------------
sendBtn.addEventListener("click", handleSubmit);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSubmit();
});

loadMockData().catch((err) => {
  console.error("Failed to load mock data:", err);
  alert("Could not load mock-data JSON files. Make sure you're running this through a local server (e.g. VS Code Live Server), not by double-clicking index.html.");
});