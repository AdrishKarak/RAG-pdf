# PDF RAG Chat

An open-source local RAG app for uploading PDF files and asking questions against their contents.

The project is split into:

- `client/` - Next.js UI with Clerk authentication
- `server/` - Express API for PDF upload and retrieval
- `docker-compose.yml` - local Qdrant and Valkey services

## What It Does

- Upload a PDF from the browser
- Extract and store the document in Qdrant
- Ask natural-language questions about the uploaded PDFs
- Return answers grounded in the retrieved document context

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Auth: Clerk
- API: Express
- PDF parsing: `@langchain/community`
- Vector store: Qdrant
- LLM: Groq
- Queueing worker: BullMQ
- Local infra: Docker Compose, Valkey, Qdrant

## Repository Layout

```text
client/      Next.js app and UI
server/      Express API, worker, uploads, and env file
docker-compose.yml  Local Qdrant and Valkey services
.env.example Example environment variables for the project
Architecture.md System architecture and data flow
```

## Requirements

- Node.js 18+ or newer
- pnpm 11+ recommended
- Docker and Docker Compose
- A Groq API key
- A Clerk application for authentication

## Local Setup

1. Install dependencies in both apps.

```bash
cd server
pnpm install

cd ../client
pnpm install
```

2. Start local infrastructure.

```bash
docker compose up -d
```

This starts:

- Qdrant on `http://localhost:6333`
- Valkey on `localhost:6379`

3. Create your environment files from the app-specific examples.

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Then fill the values as described below.

4. Start the server.

```bash
cd server
pnpm run dev
```

5. Start the client.

```bash
cd client
pnpm run dev
```

Open the app in the browser at `http://localhost:3000`.

## Environment Variables

### Server

- `GROQ_API_KEY` - required, used for answer generation

### Client

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - required for Clerk on the browser side
- `CLERK_SECRET_KEY` - required for server-side Clerk auth checks

## Example Keys

You need to create these in the external services, then place the values in your `.env` files:

- Groq API key from the Groq dashboard
- Clerk publishable key and secret key from your Clerk application

No repository secrets should be committed.

The root `.env.example` is a convenience overview of the required variables across both apps.

## API Endpoints

- `POST /upload/pdf`
  - Accepts `multipart/form-data`
  - Field name: `pdf`
  - Stores the file locally and indexes it into Qdrant

- `GET /chat?message=...`
  - Retrieves relevant PDF content from Qdrant
  - Sends the context and question to Groq
  - Returns the generated answer and the retrieved sources

## How Uploads Work

The current upload flow is synchronous:

1. The browser sends the PDF to `server/index.js`
2. The server stores the file under `server/uploads/`
3. The server parses the PDF and writes a single document into Qdrant
4. The UI marks the PDF as ready once indexing succeeds

The worker in `server/worker.js` is still present for queue-based processing, but the default upload path no longer depends on it.

## Troubleshooting

- If uploads fail, confirm the server is running on port `8000`.
- If answers are empty or incorrect, confirm Qdrant is running and the collection exists.
- If authentication fails, check the Clerk keys in `client/.env`.
- If Groq responses fail, check `GROQ_API_KEY` in `server/.env`.
- If ports are busy, stop the conflicting process or change the local port.

## Development Notes

- Uploaded PDFs are stored in `server/uploads/`
- Qdrant collection name: `pdf-documents-langchain`
- The client talks to the server at `http://localhost:8000`
- The local infra defaults are defined in `docker-compose.yml`

## Contributing

- Keep secrets out of git
- Update `Architecture.md` when the data flow changes
- Update `.env.example` whenever a new required variable is added
