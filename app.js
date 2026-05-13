const analyzerPrompt = `Wites & Rogers Insurance Policy Coverage Analyzer.\nPlease upload your Insurance Policy (PDF File). After uploaded, click the button ANALYZE POLICY`;

const claimScenarioPrompt = `When answering a specific claim or situation, use this structure:

Likely Coverage Result:
Covered / Limited / Excluded / Unclear

Why:
Explain in simple language.

Policy Reference:
Quote or cite the page, section, endorsement, exclusion, or condition if available.

Important Warning:
Mention any deductible, limitation, condition, exclusion, documentation requirement, deadline, or unclear language.`;

const form = document.querySelector("#policyForm");
const filesInput = document.querySelector("#policyFiles");
const fileList = document.querySelector("#fileList");
const policyText = document.querySelector("#policyText");
const policyType = document.querySelector("#policyType");
const analysisMode = document.querySelector("#analysisMode");
const scenarioField = document.querySelector("#scenarioField");
const claimScenario = document.querySelector("#claimScenario");
const reportOutput = document.querySelector("#reportOutput");
const copyButton = document.querySelector("#copyButton");
const resetButton = document.querySelector("#resetButton");
const statusPill = document.querySelector("#statusPill");
const analyzeButton = document.querySelector("#analyzeButton");

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderFiles() {
  const files = Array.from(filesInput.files);
  fileList.innerHTML = "";

  if (!files.length) return;

  for (const file of files) {
    const item = document.createElement("div");
    item.className = "file-item";
    item.innerHTML = `<span>${file.name}</span><small>${formatFileSize(file.size)}</small>`;
    fileList.append(item);
  }
}

function buildOutput() {
  const selectedFiles = Array.from(filesInput.files).map((file) => `- ${file.name} (${formatFileSize(file.size)})`);
  const text = policyText.value.trim();
  const scenario = claimScenario.value.trim();
  const type = policyType.value || "Auto-identify from document";
  const mode = analysisMode.value;

  const warnings = [];
  if (!text) warnings.push("Paste extracted policy text before sending this to an AI model.");
  if (mode === "claim" && !scenario) warnings.push("Add the claim scenario before requesting a claim-specific answer.");

  statusPill.textContent = warnings.length ? "Needs text" : "Ready";
  statusPill.classList.toggle("warn", warnings.length > 0);

  const documentBlock = text || "[Paste extracted policy text here before analysis.]";
  const fileBlock = selectedFiles.length ? selectedFiles.join("\n") : "- No PDF files selected in this workspace.";
  const scenarioBlock = mode === "claim" ? `\nCLAIM SCENARIO:\n${scenario || "[Add the claim scenario here.]"}\n\n${claimScenarioPrompt}\n` : "";

  return `${analyzerPrompt}




`;
}

function updateOutput() {
  reportOutput.textContent = buildOutput();
}

function setWorking(isWorking) {
  analyzeButton.disabled = isWorking;
  analyzeButton.textContent = isWorking ? "Analyzing..." : "Analyze Policy";
  statusPill.textContent = isWorking ? "Analyzing" : statusPill.textContent;
}

filesInput.addEventListener("change", () => {
  renderFiles();
  updateOutput();
});

analysisMode.addEventListener("change", () => {
  scenarioField.hidden = analysisMode.value !== "claim";
  updateOutput();
});

form.addEventListener("input", updateOutput);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateOutput();

  const text = policyText.value.trim();
  const files = Array.from(filesInput.files);

  if (!text && !files.length) {
    reportOutput.textContent = "Upload at least one policy PDF or paste policy text before analyzing.";
    statusPill.textContent = "Needs text";
    statusPill.classList.add("warn");
    reportOutput.focus();
    return;
  }

  const formData = new FormData();
  formData.append("policyText", text);
  formData.append("policyType", policyType.value);
  formData.append("analysisMode", analysisMode.value);
  formData.append("claimScenario", claimScenario.value.trim());

  for (const file of files) {
    formData.append("policyFiles", file);
  }

  setWorking(true);
  reportOutput.textContent = "Analyzing the policy. This can take a little while for long PDFs.";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    reportOutput.textContent = data.analysis || "The analysis completed, but no report text was returned.";
    statusPill.textContent = "Complete";
    statusPill.classList.remove("warn");
  } catch (error) {
    reportOutput.textContent = `Analysis error:\n${error.message}`;
    statusPill.textContent = "Error";
    statusPill.classList.add("warn");
  } finally {
    setWorking(false);
    reportOutput.focus();
  }
});

copyButton.addEventListener("click", async () => {
  updateOutput();
  await navigator.clipboard.writeText(reportOutput.textContent);
  const original = copyButton.textContent;
  copyButton.textContent = "Copied";
  setTimeout(() => {
    copyButton.textContent = original;
  }, 1300);
});

resetButton.addEventListener("click", () => {
  form.reset();
  scenarioField.hidden = true;
  fileList.innerHTML = "";
  updateOutput();
});

scenarioField.hidden = true;
updateOutput();
