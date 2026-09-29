from fastapi import FastAPI, UploadFile, File
from pypdf import PdfReader
import os
from dotenv import load_dotenv
from openai import OpenAI
import numpy as np
import psycopg
from pydantic import BaseModel
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# connecting to PostgreSQL
def get_db_connection():
    return psycopg.connect(
        host=os.getenv("POSTGRES_HOST"),
        port=os.getenv("POSTGRES_PORT"),
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD")
    )

@app.get("/test-db")
def test_db():
    conn = get_db_connection()

    with conn.cursor() as cursor:
        cursor.execute("SELECT 1;")
        result = cursor.fetchone()

    conn.close()

    return {
        "message": "Database connected",
        "result": result
    }


#storing documents into PostgreSQL

def vector_to_string(vector):
    return "[" + ",".join(map(str, vector)) + "]"

def index_document(file_path: str, filename: str):
    text = read_pdf(file_path)
    chunks = split_text(text)

    conn = get_db_connection()

    with conn.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO document (filename)
            VALUES (%s)
            RETURNING id;
            """,
            (filename,)
        )

        document_id = cursor.fetchone()[0]

        for chunk in chunks:
            embedding = get_embedding(chunk)

            cursor.execute(
                """
                INSERT INTO chunks (text, embedding)
                VALUES (%s, %s::vector);
                """,
                (
                    document_id,
                    chunk,
                    vector_to_string(embedding)
                )
            )

    conn.commit()
    conn.close()

    return document_id, len(chunks)

load_dotenv()

# connect to LLM
client = OpenAI(
    base_url=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_key=os.getenv("AZURE_OPENAI_API_KEY")
)

# homepage
@app.get("/")
def home():
    return {"message": "RAG Study Assistant is running"}

# upload pdf file
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()

    temp_path = f"data/{file.filename}"

    with open(temp_path, "wb") as f:
        f.write(contents)

    document_id, count = index_document(
        temp_path,
        file.filename
    )
    count = index_document(temp_path)

    return {
        "message": "File uploaded and indexed",
        "document_id": document_id,
        "filename": file.filename,
        "number_of_chunks": count
    }

# processing file
# extracting text from pdf
# later can be adapted to other file formats
def read_pdf(file_path: str):
    reader = PdfReader(file_path)

    text = ""

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            text += page_text + "\n"

    return text

# spliting text into chuncks
def split_text(text: str, chunk_size: int = 500, overlap: int = 100):
    chunks = []

    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        chunks.append(chunk)

        start += chunk_size - overlap

    return chunks

# embedding: converting text to vectors
def get_embedding(text:str):
    response = client.embeddings.create(
        model=os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT"),
        input=text
    )

    return response.data[0].embedding

@app.get("/test-embedding")
def test_embedding():
    embedding = get_embedding("What is selective repeat?")

    return {
        "dimensions": len(embedding),
        "first_10_values": embedding[:10]
    }

# get the cosine of 2 vectors
# higher ratio implies closer relation of quesion and text
def cosine_similarity(vec1, vec2):
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)

    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

#retrival function
def retrieve_relevant_chunks(question:str, document_id: Optional[int] = None, top_k = 3):
    question_embedding = get_embedding(question)
    question_vector = vector_to_string(question_embedding)
    conn = get_db_connection()

    with conn.cursor() as cursor:

        if document_id is None: #Search all
            cursor.execute(
                """
                SELECT 
                    text,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM chunks
                ORDER BY embedding <=> %s::vector
                LIMIT %s;
                """,
                (
                    question_vector,
                    question_vector,
                    top_k
                )
            )

        else: #Search only one document
            cursor.execute(
                """
                SELECT 
                    text,
                    1 - (embedding <=> %s::vector) AS similarity
                FROM chunks
                WHERE document_id = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s;
                """,
                (
                    question_vector,
                    question_vector,
                    top_k
                )
            )

        rows = cursor.fetchall()

    conn.close()

    return [
        {
            "chunk": row[0],
            "score": row[1]
        }
        for row in rows
    ]

@app.get("/test-retrieval")
def test_retrieval(question:str):
    return retrieve_relevant_chunks(question)

# ask question
class AskRequest(BaseModel):
    question: str
    document_id: Optional[int] = None

@app.post("/ask")
def ask(request: AskRequest):
    retrieved_chunks = retrieve_relevant_chunks(request.question, request.document_id)

    answer = generate_answer(
        request.question,
        retrieved_chunks
    )
    return {
        "question":request.question,
        "document_id": request.document_id,
        "answer": answer,
        "sources": retrieved_chunks
    }

# answering
def generate_answer(question: str, retrieved_chunks):
    context = "\n\n".join(
        chunk["chunk"] for chunk in retrieved_chunks
    )

    response = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a study assistant. "
                    "Answer using only the context provided."
                    "If the answer is not in the context, say you don't know. "
                )
            },
            {
                "role": "user",
                "content": f"""
Context:
{context}

Question:
{question}
"""
            }
        ]
    )

    return response.choices[0].message.content

# get all documents uploaded
@app.get("/documents")
def get_documents():
    conn = get_db_connection()

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, filename, uploaded_at
            FROM documents
            ORDER BY uploaded_at DESC;
            """
        )

        rows = cursor.fetchall()

    conn.close()

    return [
        {
            "id": row[0],
            "filename": row[1],
            "uploaded_at": row[2]
        }
        for row in rows
    ]

# quick dna
QUICK_ACTIONS = {
    "why": "Why is this true? Explain the reason briefly.",
    "explain_more": "Explain this in more detail.",
    "simplify": "Explain this in simpler words.",
    "example": "Give a simple example of this concept."
}

class QuickAskRequest(BaseModel):
    selected_text: str
    action: Optional[str] = None
    question: Optional[str] = None
    document_id: Optional[int] = None

def generate_quick_answer(
    selected_text: str,
    question: str,
    retrieved_chunks
):
    context = "\n\n".join(
        chunk["chunk"] for chunk in retrieved_chunks
    )

    response = client.chat.completions.create(
        model=os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT"),
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a concise study assistant. "
                    "Explain only the selected concept. "
                    "Keep the answer short and focused. "
                    "Use the retrieved context when helpful."
                )
            },
            {
                "role": "user",
                "content": f"""
Selected text:
{selected_text}

Retrieved context:
{context}

Question:
{question}
"""
            }
        ]
    )

    return response.choices[0].message.content

@app.post("/quick-ask")
def quick_ask(request: QuickAskRequest):

    if request.action:
        question = QUICK_ACTIONS.get(request.action)

        if question is None:
            return {"error": "Invalid quick action"}

    elif request.question:
        question = request.question

    else:
        return {"error": "Provide either action or question"}

    retrieval_query = (
        request.selected_text
        + "\n"
        + question
    )

    retrieved_chunks = retrieve_relevant_chunks(
        retrieval_query,
        request.document_id
    )

    answer = generate_quick_answer(
        request.selected_text,
        question,
        retrieved_chunks
    )

    return {
        "selected_text": request.selected_text,
        "action": request.action,
        "question": question,
        "answer": answer
    }

# download file
@app.get("/documents/{document_id}/download")
def download_document(document_id: int):
    conn = get_db_connection()

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT filename
            FROM documents
            WHERE id = %s;
            """,
            (document_id,)
        )

        row = cursor.fetchone()

    conn.close()

    if row is None:
        return {"error": "Document not found"}

    filename = row[0]
    file_path = Path("data") / filename

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/pdf"
    )

# delete file
@app.delete("/documents/{document_id}")
def delete_document(document_id: int):
    conn = get_db_connection()

    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT filename
            FROM documents
            WHERE id = %s;
            """,
            (document_id,)
        )

        row = cursor.fetchone()

        if row is None:
            conn.close()
            return {"error": "Document not found"}

        filename = row[0]

        cursor.execute(
            """
            DELETE FROM chunks
            WHERE document_id = %s;
            """,
            (document_id,)
        )

        cursor.execute(
            """
            DELETE FROM documents
            WHERE id = %s;
            """,
            (document_id,)
        )

    conn.commit()
    conn.close()

    file_path = Path("data") / filename

    if file_path.exists():
        file_path.unlink()

    return {
        "message": "Document deleted"
    }