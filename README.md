# Insurance Policy Coverage Analyzer

A small web app that lets users upload insurance policy PDFs, send them to an AI analysis endpoint, and receive a plain-English policy coverage report.

## Local Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create a `.env` file from `.env.example`:

   ```powershell
   copy .env.example .env
   ```

3. Add your OpenAI API key to `.env`:

   ```text
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-5.2
   PORT=5174
   ```

4. Start the app:

   ```powershell
   npm start
   ```

5. Open:

   ```text
   http://127.0.0.1:5174
   ```

## API Endpoint

`POST /api/analyze`

Accepts `multipart/form-data`:

- `policyFiles`: one or more PDF files
- `policyText`: optional pasted policy text
- `policyType`: optional selected policy type
- `analysisMode`: `full` or `claim`
- `claimScenario`: optional claim scenario text

Returns:

```json
{
  "analysis": "Insurance Policy Analysis Report...",
  "responseId": "resp_...",
  "model": "gpt-5.2"
}
```

## Deploy Online

For a simple hosted backend, use Render, Railway, Fly.io, or another Node-capable host.

Set these environment variables in your host dashboard:

```text
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.2
PORT=provided_by_host
```

Use these commands:

```text
Build command: npm install
Start command: npm start
```

## Privacy Notes

Insurance policies may contain personal, financial, property, and business information. For production use, add authentication, HTTPS, audit logging rules, upload size controls, and a clear data retention policy.
