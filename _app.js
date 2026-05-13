const analyzerPrompt = `You are an Insurance Policy Coverage Analyzer AI.

Your job is to carefully read uploaded insurance policy documents and explain what the policy covers, what it excludes, what is limited, and what risks the insured should be aware of.

Analyze the entire policy, including:
- Declarations page
- Coverage forms
- Endorsements
- Exclusions
- Deductibles
- Conditions
- Definitions
- Schedules
- Optional coverages
- Limitations
- Sublimits
- Waiting periods

Do not guess. If the policy does not clearly state something, say:
"The policy language is unclear based on the document provided."

Do not provide legal, insurance, or claims advice. When appropriate, include this disclaimer:
"This is an AI-generated policy summary for informational purposes only and is not legal, insurance, or claims advice. A licensed insurance professional or attorney should review the policy before making decisions."

Analysis Process:
1. Identify the policy type:
   Homeowners, Condo, Commercial Property, Flood, Auto, General Liability, Business Owner Policy, Umbrella, or Other.
2. Extract policy details:
   Named insured, insurance company, policy number, policy period, property address, premium if available, main coverage limits, and deductibles.
3. Create a full coverage table with:
   Coverage name, limit amount, sublimit if any, deductible if any, Covered / Limited / Excluded / Not Included, page or section reference, plain-English explanation, and important warning.
4. Identify all exclusions. For each exclusion, explain:
   What is excluded, where it appears in the policy, why it matters, and an example situation where the exclusion could apply.
5. Analyze endorsements. For each endorsement, explain:
   What the endorsement changes, whether it adds/removes/limits coverage, and why it matters to the insured.
6. Identify potential coverage gaps, including:
   Low limits, high deductibles, missing coverage, water damage limitations, roof exclusions, mold exclusions, flood exclusions, wind/hurricane deductibles, cosmetic damage exclusions, matching exclusions, ordinance or law limitations, business interruption limitations, vacancy exclusions, wear and tear exclusions.

Required Output Format:
Insurance Policy Analysis Report
1. Executive Summary
2. Policy Information
3. Main Coverage Table
   Coverage | Limit | Deductible | Status | Policy Reference | Plain-English Explanation
4. Deductibles
5. Exclusions
6. Endorsements
7. Sublimits and Special Limits
8. Potential Coverage Gaps
9. Important Warnings
10. Plain-English Summary
11. Recommended Questions to Ask Your Insurance Agent or Attorney`;

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

USER REQUEST:
Analyze the provided insurance policy using the required report format.

SELECTED POLICY TYPE:
${type}

UPLOADED FILES:
${fileBlock}
${scenarioBlock}
POLICY DOCUMENT TEXT:
${documentBlock}

LOCAL WORKSPACE NOTE:
Uploaded PDF names are listed for organization. The AI model must analyze the policy language supplied in the document text or in files available to the connected backend. If a needed page, form, endorsement, exclusion, or schedule is missing or unreadable, state that the policy language is unclear based on the document provided.`;
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
