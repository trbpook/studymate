const API_URL = "http://127.0.0.1:8000";

export async function getDocuments() {
  const response = await fetch(`${API_URL}/documents`);

  if (!response.ok) {
    throw new Error("Failed to load documents");
  }

  return response.json();
}


export async function askQuestion(question, documentId = null) {
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

  if (!response.ok) {
    throw new Error("Failed to ask question");
  }

  return response.json();
}


export async function uploadDocument(file) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload document");
  }

  return response.json();
}


export async function quickAsk({
  selectedText,
  action = null,
  question = null,
  documentId = null,
}) {
  const response = await fetch(`${API_URL}/quick-ask`, {
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
  });

  if (!response.ok) {
    throw new Error("Failed to ask follow-up");
  }

  return response.json();
}

export async function deleteDocument(documentId) {
  const response = await fetch(
    `${API_URL}/documents/${documentId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete document");
  }

  return response.json();
}

export function getDownloadUrl(documentId) {
  return `${API_URL}/documents/${documentId}/download`;
}