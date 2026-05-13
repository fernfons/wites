import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 5174);
const model = process.env.OPENAI_MODEL || "gpt-5.2";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 8,
  },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      callback(new Error("Only PDF files are supported."));
      return;
    }
    callback(null, true);
  },
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

app.use(express.static(__dirname));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    model,
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post("/api/analyze", upload.array("policyFiles", 8), async (request, response, next) => {
  const uploadedFileIds = [];

  try {
    if (!process.env.OPENAI_API_KEY) {
      response.status(500).json({
        error: "Missing OPENAI_API_KEY. Add it to your environment or .env file, then restart the server.",
      });
      return;
    }

    const policyType = request.body.policyType || "Auto-identify from document";
    const analysisMode = request.body.analysisMode || "full";
    const policyText = request.body.policyText || "";
    const claimScenario = request.body.claimScenario || "";
    const files = request.files || [];

    if (!files.length && !policyText.trim()) {
      response.status(400).json({
        error: "Upload at least one policy PDF or paste policy text before analyzing.",
      });
      return;
    }

    const content = [];

    for (const file of files) {
      const openaiFile = await client.files.create({
        file: await toFile(file.buffer, file.originalname, { type: file.mimetype }),
        purpose: "user_data",
      });
      uploadedFileIds.push(openaiFile.id);
      content.push({
        type: "input_file",
        file_id: openaiFile.id,
      });
    }

    const scenarioBlock =
      analysisMode === "claim"
        ? `\nCLAIM SCENARIO:\n${claimScenario || "No claim scenario was provided."}\n\n${claimScenarioPrompt}\n`
        : "";

    content.push({
      type: "input_text",
      text: `${analyzerPrompt}

USER REQUEST:
Analyze the provided insurance policy using the required report format.

SELECTED POLICY TYPE:
${policyType}
${scenarioBlock}
POLICY DOCUMENT TEXT PROVIDED BY USER:
${policyText || "No pasted policy text was provided. Analyze the uploaded PDF files."}

IMPORTANT:
If a needed page, form, endorsement, exclusion, condition, definition, or schedule is missing or unreadable, say: "The policy language is unclear based on the document provided."`,
    });

    const result = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content,
        },
      ],
    });

    response.json({
      analysis: result.output_text,
      responseId: result.id,
      model,
    });
  } catch (error) {
    next(error);
  } finally {
    await Promise.allSettled(uploadedFileIds.map((fileId) => client.files.del(fileId)));
  }
});

app.use((error, _request, response, _next) => {
  const message = error?.message || "Analysis failed.";
  const status = message.includes("Only PDF") ? 400 : 500;
  response.status(status).json({ error: message });
});

app.listen(port, () => {
  console.log(`Insurance Policy Coverage Analyzer running on port ${port}`);
});
