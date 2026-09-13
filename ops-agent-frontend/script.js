const historyEl = document.getElementById("history");
const inputEl = document.getElementById("command-input");
const sendBtn = document.getElementById("send-btn");

let clusterState = null;
let stubResponses = [];
let gitState = null;

async function loadMockData() {
  const [clusterRes, stubRes, gitRes] = await Promise.all([
    fetch("mock-data/cluster-state.json"),
    fetch("mock-data/stub-responses.json"),
    fetch("mock-data/git-state.json"),
  ]);
  clusterState = await clusterRes.json();
  stubResponses = await stubRes.json();
  gitState = await gitRes.json();
}

async function getTranslation(userInput) {
  const lower = userInput.toLowerCase();
  const match = stubResponses.find((r) =>
    lower.includes(r.resource_name.toLowerCase()) &&
    lower.includes((r.namespace || "").toLowerCase())
  );
  if (match) return { tool: "kubectl", namespace: "", ...match };

  return {
    original_input: userInput,
    tool: "kubectl",
    command: `kubectl get pods -n default`,
    resource_type: "pod",
    resource_name: "*",
    namespace: "default",
    is_destructive: false,
    risk_reason: "No matching stub — defaulted to a safe read-only command",
  };
}

async function getBlastRadius(tool, namespace, resourceName) {
  if (tool === "git") {
    const branch = gitState ? gitState[resourceName] : null;
    if (!branch) return { found: false, detail: "unknown branch" };
    return {
      found: true,
      detail: branch.protected
        ? `${resourceName} is a protected branch`
        : `${branch.unpushed_commits} unpushed commit(s) would be affected`,
    };
  }

  const ns = clusterState ? clusterState[namespace] : null;
  if (!ns || !ns[resourceName]) {
    return { found: false, pods: 0 };
  }
  return { found: true, pods: ns[resourceName].pods };
}

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

  const blast = await getBlastRadius(translation.tool, translation.namespace, translation.resource_name);
  const detailLine =
    translation.tool === "git"
      ? (blast.found ? blast.detail : "unknown branch state")
      : `Affected pods: ${blast.found ? blast.pods : "unknown"}`;

  const namespaceLine = translation.namespace
    ? `Namespace: ${translation.namespace}${translation.namespace === "prod" ? " (PRODUCTION)" : ""}<br>`
    : "";

  const card = document.createElement("div");
  card.className = "warning-card";
  card.innerHTML = `
    ⚠️ <strong>${escapeHtml(translation.command)}</strong><br>
    Tool: ${translation.tool}<br>
    ${namespaceLine}
    ${detailLine}<br>
    Risk: ${escapeHtml(translation.risk_reason)}<br>
    This action is irreversible.<br>
    <button class="confirm-btn">Confirm &amp; Run</button>
  `;
  entry.appendChild(card);
  scrollToBottom();

  confirmBtn.addEventListener("click", async () => {
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Running...";

  const output = document.createElement("div");
  output.className = "confirmed-output";

  if (translation.tool === "git") {
    const res = await fetch("http://localhost:3001/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: translation.command }),
    });
    const result = await res.json();
    output.textContent = result.success
      ? (result.output || "Command executed.")
      : `Error: ${result.output}`;
  } else {
    output.textContent = fakeDestructiveOutput(translation);
  }

  confirmBtn.remove();
  card.appendChild(output);
  sendBtn.disabled = false;
  scrollToBottom();
});
}

function fakeSafeOutput(translation) {
  if (translation.command.includes("get pods")) {
    return (
      "NAME                          READY   STATUS    RESTARTS   AGE\n" +
      "auth-service-7d8f9c-abc12     1/1     Running   0          3d\n" +
      "auth-service-7d8f9c-def34     1/1     Running   0          3d"
    );
  }
  if (translation.tool === "git") {
    return "On branch main\nnothing to commit, working tree clean";
  }
  return "Command executed successfully.";
}

function fakeDestructiveOutput(translation) {
  if (translation.tool === "git") {
    return `To origin\n + ${translation.resource_name} -> ${translation.resource_name} (forced update)`;
  }
  return `deployment.apps "${translation.resource_name}" deleted`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

sendBtn.addEventListener("click", handleSubmit);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSubmit();
});

loadMockData().catch((err) => {
  console.error("Failed to load mock data:", err);
  alert("Could not load mock-data JSON files. Make sure you're running this through a local server, not by double-clicking index.html.");
});