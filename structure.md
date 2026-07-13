Usual structure , can be used for JS too. 

rag-project/
│
├── src/
│   ├── ingestion/
│   │   ├── pdf.ts
│   │   ├── web.ts
│   │   └── loader.ts
│   │
│   ├── chunking/
│   │   ├── textSplitter.ts
│   │   └── markdownSplitter.ts
│   │
│   ├── embeddings/
│   │   ├── openai.ts
│   │   ├── gemini.ts
│   │   └── embeddingService.ts
│   │
│   ├── vectorstore/
│   │   ├── pinecone.ts
│   │   ├── qdrant.ts
│   │   ├── chroma.ts
│   │   └── index.ts
│   │
│   ├── retrieval/
│   │   ├── retriever.ts
│   │   ├── reranker.ts
│   │   └── hybridSearch.ts
│   │
│   ├── llm/
│   │   ├── openai.ts
│   │   ├── gemini.ts
│   │   └── chat.ts
│   │
│   ├── prompts/
│   │   ├── ragPrompt.ts
│   │   └── summaryPrompt.ts
│   │
│   ├── api/
│   │   ├── upload.ts
│   │   ├── chat.ts
│   │   └── health.ts
│   │
│   ├── queue/
│   │   ├── workers/
│   │   └── jobs/
│   │
│   ├── utils/
│   ├── config/
│   ├── types/
│   └── app.ts
│
├── uploads/
├── tests/
├── .env
├── package.json
├── tsconfig.json
└── README.md

Better production architecture

For a scalable system, I'd separate ingestion from querying:

Client
   │
   ▼
Express API
   │
   ├── Upload PDF
   │      │
   │      ▼
   │   BullMQ Queue
   │      │
   │      ▼
   │   Worker
   │      │
   │      ├── Parse PDF
   │      ├── Chunk
   │      ├── Create Embeddings
   │      └── Store in Vector DB
   │
   └── Chat Endpoint
          │
          ▼
     Retriever
          │
          ▼
      Prompt Builder
          │
          ▼
         LLM
          │
          ▼
       Response