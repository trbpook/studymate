const API_URL = "http://127.0.0.1:8000";


async function parseResponse(response, message) {
  if (!response.ok) {
    let detail = message;

    try {
      const body = await response.json();
      detail = body.detail || message;
    } catch {
      // Keep fallback message.
    }

    throw new Error(detail);
  }

  return response.json();
}


// ============================================================
// Documents
// ============================================================

export async function getDocuments() {
  const response = await fetch(`${API_URL}/documents`);

  return parseResponse(
    response,
    "Failed to load documents"
  );
}


export async function uploadDocument(file) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  return parseResponse(
    response,
    "Failed to upload document"
  );
}


export async function updateDocumentAlias(
  documentId,
  alias
) {
  const response = await fetch(
    `${API_URL}/documents/${documentId}/alias`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        alias,
      }),
    }
  );

  return parseResponse(
    response,
    "Failed to save document alias"
  );
}


export async function deleteDocument(documentId) {
  const response = await fetch(
    `${API_URL}/documents/${documentId}`,
    {
      method: "DELETE",
    }
  );

  return parseResponse(
    response,
    "Failed to delete document"
  );
}


export function getDownloadUrl(documentId) {
  return `${API_URL}/documents/${documentId}/download`;
}


// ============================================================
// Main RAG
// ============================================================

export async function askQuestion(
  question,
  documentId = null
) {
  const response = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      document_id: documentId,
    }),
  });

  return parseResponse(
    response,
    "Failed to ask question"
  );
}


// ============================================================
// Inline Quick Q&A
// ============================================================

export async function quickAsk({
  selectedText,
  action = null,
  question = null,
  documentId = null,
}) {
  const response = await fetch(
    `${API_URL}/quick-ask`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        selected_text: selectedText,
        action,
        question,
        document_id: documentId,
      }),
    }
  );

  return parseResponse(
    response,
    "Failed to ask Quick Q&A"
  );
}


// ============================================================
// Saved solutions
// ============================================================

export async function saveSolution({
  title = null,
  question,
  answer,
  documentId = null,
  annotations = [],
}) {
  const response = await fetch(
    `${API_URL}/saved-solutions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        question,
        answer,
        document_id: documentId,
        annotations,
      }),
    }
  );

  return parseResponse(
    response,
    "Failed to save solution"
  );
}


export async function getSavedSolutions() {
  const response = await fetch(
    `${API_URL}/saved-solutions`
  );

  return parseResponse(
    response,
    "Failed to load saved solutions"
  );
}


export async function renameSavedSolution(
  solutionId,
  title
) {
  const response = await fetch(
    `${API_URL}/saved-solutions/${solutionId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
      }),
    }
  );

  return parseResponse(
    response,
    "Failed to rename solution"
  );
}


export async function deleteSavedSolution(
  solutionId
) {
  const response = await fetch(
    `${API_URL}/saved-solutions/${solutionId}`,
    {
      method: "DELETE",
    }
  );

  return parseResponse(
    response,
    "Failed to delete solution"
  );
}


// ============================================================
// Revision quiz
// ============================================================

export async function generateRevisionQuiz(
  solutionId
) {
  const response = await fetch(
    `${API_URL}/saved-solutions/${solutionId}/quiz`,
    {
      method: "POST",
    }
  );

  return parseResponse(
    response,
    "Failed to generate revision question"
  );
}


export async function generateRandomRevisionQuiz() {
  const response = await fetch(
    `${API_URL}/revision/random-quiz`,
    {
      method: "POST",
    }
  );

  return parseResponse(
    response,
    "Failed to generate random revision question"
  );
}


export async function evaluateRevisionAnswer(
  solutionId,
  question,
  answer
) {
  const response = await fetch(
    `${API_URL}/saved-solutions/${solutionId}/evaluate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        answer,
      }),
    }
  );

  return parseResponse(
    response,
    "Failed to evaluate answer"
  );
}
