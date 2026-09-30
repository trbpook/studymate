# Studymate

Studymate is a RAG-powered study assistant that helps students learn from their own study materials.

Instead of treating AI chat as a linear conversation, Studymate allows students to highlight parts of an AI-generated solution and ask contextual follow-up questions directly beside the relevant content.

The goal is to support the full learning flow:

**Ask → Understand → Clarify → Save → Revise**

---

## Features

### Document-based RAG

Upload PDF study materials and ask questions based on their content.

Studymate:

1. extracts text from the PDF
2. splits it into overlapping chunks
3. creates embeddings using Azure OpenAI
4. stores embeddings in PostgreSQL with pgvector
5. retrieves relevant chunks using cosine similarity
6. sends the retrieved context to the language model

---

### Inline Quick Q&A

Students can highlight part of an AI-generated answer and ask a follow-up question without leaving the main solution.

Available quick actions include:

- Why?
- Explain more
- Simplify
- Give example
- Custom questions

This allows the main solution to remain linear while detailed explanations branch from individual concepts.

---

### Study Annotations

Students can annotate generated solutions using:

- Straight underline
- Wavy underline
- Highlight

Highlights act as anchors for Inline Quick Q&A, while underlines are used for personal study emphasis.

Annotations can also be removed later.

---

### Document Aliases

Uploaded documents keep their original filename, but users can assign a custom alias.

For example:

```text
SC2005_Lecture_3.pdf
```

can be displayed as:

```text
Operating Systems
```

The alias is stored persistently in PostgreSQL.

---

### Save for Revision

Studymate does not automatically save every chat.

Instead, students choose which solutions are worth keeping.

A saved revision item contains:

- original question
- AI-generated answer
- annotations
- Inline Quick Q&A
- associated document

This keeps the revision space focused instead of storing every temporary interaction.

---

### Revision Cards

Saved solutions appear as revision cards.

Users can:

- open a saved solution
- rename the card
- delete the card
- review the original annotated solution
- generate a quiz from the card

Default names follow the format:

```text
Solution 1
Solution 2
Solution 3
```

---

### Random Revision Quiz

Students can generate a random question from their entire collection of saved revision cards.

This provides a lightweight form of active recall across different topics.

---

### AI Answer Evaluation

After answering a revision question, Studymate provides:

- an AI-estimated score
- concepts answered correctly
- key points missing
- incorrect ideas
- a suggested answer

The goal is not only to identify mistakes, but to show what a stronger answer should contain.

---

## Tech Stack

### Frontend

- React
- Vite
- JavaScript
- CSS

### Backend

- Python
- FastAPI
- Pydantic
- Uvicorn

### Database

- PostgreSQL
- pgvector

### AI

- Azure OpenAI
- Embedding model
- Chat completion model

### Infrastructure

- Docker
- Docker Compose

---

## Architecture

```text
                    ┌─────────────────┐
                    │   React Client  │
                    └────────┬────────┘
                             │
                             │ REST API
                             ▼
                    ┌─────────────────┐
                    │     FastAPI     │
                    └────────┬────────┘
                             │
             ┌───────────────┴───────────────┐
             │                               │
             ▼                               ▼
    ┌─────────────────┐            ┌─────────────────┐
    │   Azure OpenAI  │            │   PostgreSQL    │
    │                 │            │   + pgvector    │
    │ Embeddings      │            │                 │
    │ Chat Completion │            │ Documents       │
    └─────────────────┘            │ Chunks          │
                                   │ Embeddings      │
                                   │ Saved Solutions │
                                   └─────────────────┘
```

---

## RAG Pipeline

### Document indexing

```text
PDF
 ↓
Text extraction
 ↓
Chunking
 ↓
Azure OpenAI Embeddings
 ↓
PostgreSQL + pgvector
```

### Question answering

```text
User Question
 ↓
Question Embedding
 ↓
Vector Similarity Search
 ↓
Relevant Chunks
 ↓
Context + Question
 ↓
Azure OpenAI Chat Model
 ↓
Answer
```

---

## Project Structure

```text
studymate/
│
├── app.py
├── docker-compose.yml
├── requirements.txt
├── README.md
│
├── data/
│
└── frontend/
    │
    ├── package.json
    │
    └── src/
        │
        ├── api.js
        ├── App.jsx
        ├── App.css
        │
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── Solution.jsx
        │   ├── AnnotationToolbar.jsx
        │   └── InlineQnA.jsx
        │
        └── pages/
            ├── ChatPage.jsx
            ├── DocumentsPage.jsx
            └── RevisionPage.jsx
```

---

## Database

Studymate currently uses three main tables.

### documents

Stores uploaded document information and user-defined aliases.

```text
id
filename
alias
uploaded_at
```

### chunks

Stores document chunks and their vector embeddings.

```text
id
text
embedding
document_id
```

### saved_solutions

Stores solutions explicitly saved for revision.

```text
id
title
question
answer
document_id
annotations
saved_at
```

Annotations and Inline Quick Q&A are stored as JSONB.

---

## Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/studymate.git
cd studymate
```

---

### 2. Create a Python virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

---

### 3. Start PostgreSQL

Make sure Docker Desktop is running.

```bash
docker compose up -d
```

---

### 4. Configure environment variables

Create a `.env` file in the project root.

```env
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=
AZURE_OPENAI_CHAT_DEPLOYMENT=

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ragdb
POSTGRES_USER=raguser
POSTGRES_PASSWORD=ragpassword
```

Do not commit `.env` to GitHub.

---

### 5. Start the backend

```bash
uvicorn app:app --reload
```

The backend runs at:

```text
http://127.0.0.1:8000
```

---

### 6. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5173
```

---

## Design Decisions

### Selective persistence

Studymate intentionally does not automatically save every chat interaction.

Chat is treated as a temporary learning workspace, while the Revision page contains only solutions that the student deliberately chooses to save.

This reduces clutter and creates a clearer separation between:

```text
Temporary exploration
        ↓
Important learning material
        ↓
Long-term revision
```

### Contextual Q&A

Traditional chat interfaces place all follow-up questions at the bottom of a conversation.

Studymate instead attaches clarification directly to the relevant part of a solution.

This allows detailed explanations to branch from individual concepts without disrupting the structure of the original answer.

---

## Future Improvements

Possible future improvements include:

- multi-document retrieval
- subject or folder organisation
- persistent revision edits
- richer Markdown rendering
- authentication and user accounts
- cloud file storage
- spaced repetition
- citation links to source document sections
- hybrid keyword + vector retrieval

---

## Status

Studymate is currently an MVP focused on exploring a more contextual workflow for AI-assisted studying.
