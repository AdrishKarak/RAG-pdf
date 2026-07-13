# PDF RAG Chat

An open-source, local RAG (Retrieval-Augmented Generation) application for uploading PDF files, chunking/indexing them asynchronously, and answering natural-language queries grounded in their contents.

The project features a decoupled, modular production architecture:
- `client/` - Next.js UI workspace with Clerk authentication.
- `server/` - Express API server, background BullMQ worker, and RAG service modules.
- `docker-compose.yml` - Local Valkey and Qdrant database services.

---

## Features

- **Decoupled Architecture**: Routes, workers, vector databases, splitters, and models are isolated in their own folders.
- **Asynchronous Queue Ingestion**: Ingests files using BullMQ queues backed by Valkey to keep the main event-loop responsive.
- **Hierarchical Text Chunking**: Splits document pages into overlapping chunks using a recursive character text splitter.
- **Smart Retrieval**: Ingests documents, chunks them recursively, and performs lexical term and phrase frequency matching to feed the context window.
- **High-Speed Generation**: Answers are generated using Groq (Llama 3.3).

---

## Repository Layout

```text
client/                 Next.js frontend app and React components
server/
  ├── src/
  │     ├── config/      Configuration loader
  │     ├── ingestion/   Document parsers
  │     ├── chunking/    Text splitting services
  │     ├── embeddings/  SimpleEmbeddings model registry
  │     ├── vectorstore/ Qdrant adapters
  │     ├── retrieval/   Search routing and scoring (retriever, reranker)
  │     ├── llm/         Groq completion client
  │     ├── prompts/     System instruction templates
  │     ├── queue/       BullMQ jobs and worker processes
  │     ├── api/         Express route controller actions
  │     └── app.js       Express entrypoint
  ├── uploads/           Raw uploaded PDF storage
  └── package.json       Backend scripts and dependency specifications
Architecture.md         Detailed system design and diagrams
Learning-journal.md     Development logs, concept review, and lessons learned
docker-compose.yml      Container definitions for Qdrant and Valkey
```

---

## Prerequisites

- **Node.js**: version 18+
- **pnpm**: version 11+ (recommended)
- **Docker**: For running containerized databases
- **API Keys**:
  - A **Groq API key** (required for chat answering)
  - A **Clerk Account** (for frontend user authentication)

---

## Local Setup

### 1. Install Dependencies
Run in both the server and client folders:

```bash
cd server
pnpm install

cd ../client
pnpm install
```

### 2. Launch Local Databases
Start Qdrant and Valkey (Redis-compatible):

```bash
docker compose up -d
```
This binds:
* Qdrant on `http://localhost:6333`
* Valkey on `localhost:6379`

### 3. Setup Environment Variables
Create the environment files from the app examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Open each `.env` and fill in your keys:
- **Server `.env`**:
  * `GROQ_API_KEY`: Required for chat answering.
- **Client `.env`**:
  * `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk client key.
  * `CLERK_SECRET_KEY`: Clerk server secret.

### 4. Run the Backend API and Worker
Start the Express API server and the BullMQ background worker:

```bash
# In the server/ directory:
# Start the API server
pnpm run dev

# Start the background worker (in a separate terminal)
pnpm run dev:worker
```

### 5. Run the Client UI
Start the Next.js development server:

```bash
# In the client/ directory:
pnpm run dev
```

Open your browser to `http://localhost:3000`.

---

## API Surface

- `POST /upload/pdf`
  - Accepts `multipart/form-data` with a `pdf` file field.
  - Enqueues an ingestion job, waits for processing, and returns `200 OK` once finished.
  
- `GET /chat?message=<query>`
  - Queries the vector index.
  - Generates an LLM response grounded in matching passages.
  - Returns the answer text and source document descriptors.

---

## Contributing & Logs
* Refer to [Architecture.md](file:///home/adrish/Desktop/pdf-rag/Architecture.md) to understand the data sequence diagrams.
* Review [Learning-journal.md](file:///home/adrish/Desktop/pdf-rag/Learning-journal.md) to check solved bugs and system design choices.
