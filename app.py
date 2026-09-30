import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from openai import OpenAI
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field
from pypdf import PdfReader


# ============================================================
# Environment
# ============================================================

load_dotenv()


# ============================================================
# FastAPI
# ============================================================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Local file storage
# ============================================================

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)


# ============================================================
# Azure OpenAI
# ============================================================

client = OpenAI(
    base_url=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
)


# ============================================================
# Database
# ============================================================

def get_db_connection():
    return psycopg.connect(
        host=os.getenv("POSTGRES_HOST"),
        port=os.getenv("POSTGRES_PORT"),
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
    )


def init_db():
    """
    Creates missing tables/columns.

    This also acts as a small migration layer for the current MVP,
    so replacing app.py will not require manually recreating tables.
    """
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE EXTENSION IF NOT EXISTS vector;
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id SERIAL PRIMARY KEY,
                    filename TEXT NOT NULL,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )

            # New: persistent user-facing alias for a document.
            cursor.execute(
                """
                ALTER TABLE documents
                ADD COLUMN IF NOT EXISTS alias TEXT;
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS chunks (
                    id SERIAL PRIMARY KEY,
                    text TEXT NOT NULL,
                    embedding VECTOR(1536),
                    document_id INTEGER REFERENCES documents(id)
                );
                """
            )

            # Safe for an older chunks table that did not yet have document_id.
            cursor.execute(
                """
                ALTER TABLE chunks
                ADD COLUMN IF NOT EXISTS document_id INTEGER REFERENCES documents(id);
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS saved_solutions (
                    id SERIAL PRIMARY KEY,
                    title TEXT,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    document_id INTEGER REFERENCES documents(id),
                    annotations JSONB DEFAULT '[]'::jsonb,
                    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )

            # Convert old titles such as "1" into "Solution 1".
            cursor.execute(
                """
                UPDATE saved_solutions
                SET title = 'Solution ' || title
                WHERE title ~ '^[0-9]+$';
                """
            )

        conn.commit()

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


@app.on_event("startup")
def startup():
    init_db()


# ============================================================
# Root
# ============================================================

@app.get("/")
def root():
    return {"message": "Studymate backend is running"}


# ============================================================
# PDF helpers
# ============================================================

def read_pdf(file_path: str):
    reader = PdfReader(file_path)
    text = ""

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            text += page_text + "\n"

    return text


def split_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100,
):
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        if chunk.strip():
            chunks.append(chunk)

        start += chunk_size - overlap

    return chunks


# ============================================================
# Embeddings
# ============================================================

def get_embedding(text: str):
    response = client.embeddings.create(
        model=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT"),
        input=text,
    )

    return response.data[0].embedding


def vector_to_string(vector):
    return "[" + ",".join(map(str, vector)) + "]"


# ============================================================
# Indexing
# ============================================================

def index_document(file_path: str, filename: str):
    text = read_pdf(file_path)

    if not text.strip():
        raise ValueError("No readable text was found in the PDF.")

    chunks = split_text(text)

    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO documents (filename)
                VALUES (%s)
                RETURNING id;
                """,
                (filename,),
            )

            document_id = cursor.fetchone()[0]

            for chunk in chunks:
                embedding = get_embedding(chunk)
                embedding_string = vector_to_string(embedding)

                cursor.execute(
                    """
                    INSERT INTO chunks (
                        text,
                        embedding,
                        document_id
                    )
                    VALUES (
                        %s,
                        %s::vector,
                        %s
                    );
                    """,
                    (
                        chunk,
                        embedding_string,
                        document_id,
                    ),
                )

        conn.commit()
        return document_id, len(chunks)

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# ============================================================
# Upload
# ============================================================

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    filename = Path(file.filename or "upload.pdf").name

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    contents = await file.read()
    file_path = DATA_DIR / filename

    try:
        with open(file_path, "wb") as f:
            f.write(contents)

        document_id, count = index_document(
            str(file_path),
            filename,
        )

        return {
            "message": "File uploaded and indexed",
            "document_id": document_id,
            "filename": filename,
            "number_of_chunks": count,
        }

    except Exception as error:
        print("Upload error:", error)
        raise


# ============================================================
# Documents
# ============================================================

@app.get("/documents")
def get_documents():
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    filename,
                    alias,
                    uploaded_at
                FROM documents
                ORDER BY uploaded_at DESC;
                """
            )

            rows = cursor.fetchall()

        return [
            {
                "id": row[0],
                "filename": row[1],
                "alias": row[2],
                "uploaded_at": row[3],
            }
            for row in rows
        ]

    finally:
        conn.close()


class DocumentAliasRequest(BaseModel):
    alias: Optional[str] = None


@app.patch("/documents/{document_id}/alias")
def update_document_alias(
    document_id: int,
    request: DocumentAliasRequest,
):
    alias = request.alias.strip() if request.alias else None

    if alias == "":
        alias = None

    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE documents
                SET alias = %s
                WHERE id = %s
                RETURNING id, filename, alias;
                """,
                (alias, document_id),
            )

            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found.",
            )

        conn.commit()

        return {
            "id": row[0],
            "filename": row[1],
            "alias": row[2],
        }

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


@app.get("/documents/{document_id}/download")
def download_document(document_id: int):
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT filename
                FROM documents
                WHERE id = %s;
                """,
                (document_id,),
            )

            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found.",
            )

        filename = row[0]
        file_path = DATA_DIR / filename

        if not file_path.exists():
            raise HTTPException(
                status_code=404,
                detail="File not found on disk.",
            )

        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="application/pdf",
        )

    finally:
        conn.close()


@app.delete("/documents/{document_id}")
def delete_document(document_id: int):
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT filename
                FROM documents
                WHERE id = %s;
                """,
                (document_id,),
            )

            row = cursor.fetchone()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Document not found.",
                )

            filename = row[0]

            # Preserve saved revision cards even if the original document
            # is deleted.
            cursor.execute(
                """
                UPDATE saved_solutions
                SET document_id = NULL
                WHERE document_id = %s;
                """,
                (document_id,),
            )

            cursor.execute(
                """
                DELETE FROM chunks
                WHERE document_id = %s;
                """,
                (document_id,),
            )

            cursor.execute(
                """
                DELETE FROM documents
                WHERE id = %s;
                """,
                (document_id,),
            )

        conn.commit()

        file_path = DATA_DIR / filename

        if file_path.exists():
            file_path.unlink()

        return {"message": "Document deleted successfully"}

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# ============================================================
# RAG retrieval
# ============================================================

def retrieve_relevant_chunks(
    question: str,
    document_id: Optional[int] = None,
    top_k: int = 3,
):
    question_embedding = get_embedding(question)
    question_vector = vector_to_string(question_embedding)

    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            if document_id is None:
                cursor.execute(
                    """
                    SELECT
                        text,
                        1 - (embedding <=> %s::vector) AS similarity
                    FROM chunks
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s;
                    """,
                    (
                        question_vector,
                        question_vector,
                        top_k,
                    ),
                )

            else:
                cursor.execute(
                    """
                    SELECT
                        text,
                        1 - (embedding <=> %s::vector) AS similarity
                    FROM chunks
                    WHERE
                        document_id = %s
                        AND embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s;
                    """,
                    (
                        question_vector,
                        document_id,
                        question_vector,
                        top_k,
                    ),
                )

            rows = cursor.fetchall()

        return [
            {
                "chunk": row[0],
                "score": float(row[1]),
            }
            for row in rows
        ]

    finally:
        conn.close()


# ============================================================
# Main answer
# ============================================================

def generate_answer(question: str, retrieved_chunks):
    if not retrieved_chunks:
        return "I don't know based on the uploaded document."

    context = "\n\n".join(
        chunk["chunk"]
        for chunk in retrieved_chunks
    )

    response = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a study assistant. "
                    "Answer using only the provided context. "
                    "Explain clearly for a student. "
                    "You may use simple Markdown formatting such as "
                    "**bold text** when it improves readability. "
                    "If the answer is not supported by the context, "
                    "say you don't know."
                ),
            },
            {
                "role": "user",
                "content": f"""
Context:

{context}

Question:

{question}
""",
            },
        ],
    )

    return response.choices[0].message.content


class AskRequest(BaseModel):
    question: str
    document_id: Optional[int] = None


@app.post("/ask")
def ask(request: AskRequest):
    retrieved_chunks = retrieve_relevant_chunks(
        question=request.question,
        document_id=request.document_id,
    )

    answer = generate_answer(
        request.question,
        retrieved_chunks,
    )

    return {
        "question": request.question,
        "document_id": request.document_id,
        "answer": answer,
        "sources": retrieved_chunks,
    }


# ============================================================
# Quick Ask
# ============================================================

QUICK_ACTIONS = {
    "why": "Why is this true? Explain the reason briefly.",
    "explain_more": "Explain this in more detail.",
    "simplify": "Explain this in simpler words.",
    "example": "Give a simple example of this concept.",
}


class QuickAskRequest(BaseModel):
    selected_text: str
    action: Optional[str] = None
    question: Optional[str] = None
    document_id: Optional[int] = None


def generate_quick_answer(
    selected_text: str,
    question: str,
    retrieved_chunks,
):
    context = "\n\n".join(
        chunk["chunk"]
        for chunk in retrieved_chunks
    )

    response = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a concise study assistant. "
                    "The student selected a specific piece of text "
                    "from an answer. Explain only that concept. "
                    "Keep the response focused and relatively short. "
                    "Use the retrieved document context when helpful."
                ),
            },
            {
                "role": "user",
                "content": f"""
Selected text:

{selected_text}

Relevant document context:

{context}

Student question:

{question}
""",
            },
        ],
    )

    return response.choices[0].message.content


@app.post("/quick-ask")
def quick_ask(request: QuickAskRequest):
    if request.action:
        question = QUICK_ACTIONS.get(request.action)

        if question is None:
            raise HTTPException(
                status_code=400,
                detail="Unknown quick action.",
            )

    elif request.question:
        question = request.question

    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either action or question.",
        )

    retrieval_query = (
        request.selected_text
        + "\n"
        + question
    )

    retrieved_chunks = retrieve_relevant_chunks(
        question=retrieval_query,
        document_id=request.document_id,
    )

    answer = generate_quick_answer(
        selected_text=request.selected_text,
        question=question,
        retrieved_chunks=retrieved_chunks,
    )

    return {
        "selected_text": request.selected_text,
        "action": request.action,
        "question": question,
        "answer": answer,
    }


# ============================================================
# Saved Solutions
# ============================================================

class SaveSolutionRequest(BaseModel):
    title: Optional[str] = None
    question: str
    answer: str
    document_id: Optional[int] = None
    annotations: List[Dict[str, Any]] = Field(default_factory=list)


@app.post("/saved-solutions")
def save_solution(request: SaveSolutionRequest):
    requested_title = (
        request.title.strip()
        if request.title and request.title.strip()
        else None
    )

    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO saved_solutions (
                    title,
                    question,
                    answer,
                    document_id,
                    annotations
                )
                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s
                )
                RETURNING id;
                """,
                (
                    requested_title,
                    request.question,
                    request.answer,
                    request.document_id,
                    Jsonb(request.annotations),
                ),
            )

            solution_id = cursor.fetchone()[0]

            if requested_title is None:
                requested_title = f"Solution {solution_id}"

                cursor.execute(
                    """
                    UPDATE saved_solutions
                    SET title = %s
                    WHERE id = %s;
                    """,
                    (
                        requested_title,
                        solution_id,
                    ),
                )

        conn.commit()

        return {
            "message": "Solution saved",
            "id": solution_id,
            "title": requested_title,
        }

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


@app.get("/saved-solutions")
def get_saved_solutions():
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    title,
                    question,
                    answer,
                    document_id,
                    annotations,
                    saved_at
                FROM saved_solutions
                ORDER BY saved_at DESC;
                """
            )

            rows = cursor.fetchall()

        return [
            {
                "id": row[0],
                "title": row[1],
                "question": row[2],
                "answer": row[3],
                "document_id": row[4],
                "annotations": row[5] or [],
                "saved_at": row[6],
            }
            for row in rows
        ]

    finally:
        conn.close()


def get_saved_solution(solution_id: int):
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    title,
                    question,
                    answer,
                    document_id,
                    annotations
                FROM saved_solutions
                WHERE id = %s;
                """,
                (solution_id,),
            )

            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Saved solution not found.",
            )

        return {
            "id": row[0],
            "title": row[1],
            "question": row[2],
            "answer": row[3],
            "document_id": row[4],
            "annotations": row[5] or [],
        }

    finally:
        conn.close()


class RenameSolutionRequest(BaseModel):
    title: str


@app.patch("/saved-solutions/{solution_id}")
def rename_saved_solution(
    solution_id: int,
    request: RenameSolutionRequest,
):
    title = request.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Title cannot be empty.",
        )

    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE saved_solutions
                SET title = %s
                WHERE id = %s
                RETURNING id, title;
                """,
                (
                    title,
                    solution_id,
                ),
            )

            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Saved solution not found.",
            )

        conn.commit()

        return {
            "id": row[0],
            "title": row[1],
        }

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


@app.delete("/saved-solutions/{solution_id}")
def delete_saved_solution(solution_id: int):
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM saved_solutions
                WHERE id = %s
                RETURNING id;
                """,
                (solution_id,),
            )

            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Saved solution not found.",
            )

        conn.commit()

        return {
            "message": "Saved solution deleted",
            "id": row[0],
        }

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


# ============================================================
# Revision Quiz
# ============================================================

def generate_revision_question(solution):
    response = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
        messages=[
            {
                "role": "system",
                "content": (
                    "You create short revision questions for students. "
                    "Choose one important concept from the saved solution "
                    "and ask one concise open-ended question. "
                    "Return only the question."
                ),
            },
            {
                "role": "user",
                "content": f"""
Original question:

{solution["question"]}

Saved solution:

{solution["answer"]}
""",
            },
        ],
    )

    return response.choices[0].message.content.strip()


@app.post("/saved-solutions/{solution_id}/quiz")
def revision_quiz(solution_id: int):
    solution = get_saved_solution(solution_id)
    question = generate_revision_question(solution)

    return {
        "solution_id": solution_id,
        "question": question,
    }


def get_random_saved_solution():
    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id,
                    title,
                    question,
                    answer,
                    document_id,
                    annotations
                FROM saved_solutions
                ORDER BY RANDOM()
                LIMIT 1;
                """
            )

            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="No saved solutions available.",
            )

        return {
            "id": row[0],
            "title": row[1],
            "question": row[2],
            "answer": row[3],
            "document_id": row[4],
            "annotations": row[5] or [],
        }

    finally:
        conn.close()


@app.post("/revision/random-quiz")
def random_revision_quiz():
    """
    Random question from the complete saved revision set.
    """
    solution = get_random_saved_solution()
    question = generate_revision_question(solution)

    return {
        "solution_id": solution["id"],
        "question": question,
    }


# ============================================================
# Quiz evaluation
# ============================================================

class QuizAnswerRequest(BaseModel):
    question: str
    answer: str


def parse_json_response(content: str):
    content = content.strip()

    if content.startswith("```"):
        lines = content.splitlines()

        if len(lines) >= 3:
            content = "\n".join(lines[1:-1])

    return json.loads(content)


def evaluate_revision_answer(
    solution,
    quiz_question: str,
    user_answer: str,
):
    response = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
        messages=[
            {
                "role": "system",
                "content": (
                    "You evaluate a student's understanding based on "
                    "the provided saved study solution. "
                    "Return ONLY valid JSON and no Markdown."
                ),
            },
            {
                "role": "user",
                "content": f"""
Source study solution:

{solution["answer"]}

Quiz question:

{quiz_question}

Student answer:

{user_answer}

Evaluate the answer.

Focus on what the student understands, what important key points are
missing, and what a strong answer should contain.

Return exactly this JSON structure:

{{
  "score": 0,
  "overall": "",
  "correct": [],
  "key_points_missing": [],
  "incorrect": [],
  "suggested_answer": ""
}}

Rules:
- score must be an integer from 0 to 100.
- key_points_missing should be specific concepts or statements the
  student should have included.
- suggested_answer should be a concise model answer to the quiz question.
""",
            },
        ],
    )

    content = response.choices[0].message.content

    try:
        result = parse_json_response(content)

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="AI returned an invalid evaluation format.",
        )

    return result


@app.post("/saved-solutions/{solution_id}/evaluate")
def evaluate_quiz(
    solution_id: int,
    request: QuizAnswerRequest,
):
    solution = get_saved_solution(solution_id)

    return evaluate_revision_answer(
        solution=solution,
        quiz_question=request.question,
        user_answer=request.answer,
    )
