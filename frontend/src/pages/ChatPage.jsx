import { useEffect, useState } from "react";
import { getDocuments, askQuestion } from "../api";
import Solution from "../components/Solution";


export default function ChatPage({ setCurrentPage }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);

  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [annotations, setAnnotations] = useState([]);

  setAnswer(result.answer);
  setAnnotations([]);

  useEffect(() => {
    async function loadDocuments() {
      const data = await getDocuments();
      setDocuments(data);

      if (data.length > 0) {
        setSelectedDocumentId(data[0].id);
        setSubject(data[0].filename);
      }
    }

    loadDocuments();
  }, []);

  function handleDocumentChange(event) {
    const id = Number(event.target.value);

    setSelectedDocumentId(id);

    const selectedDocument = documents.find(
      (document) => document.id === id
    );

    if (selectedDocument) {
      setSubject(selectedDocument.filename);
    }
  }

  async function handleAsk() {
    if (!question.trim()) return;

    setLoading(true);

    const result = await askQuestion(
      question,
      selectedDocumentId
    );

    setAnswer(result.answer);
    setQuestion("");
    setLoading(false);
  }

  if (documents.length === 0) {
    return (
      <main className="chat-page empty-state">
        <h1>No documents yet</h1>

        <p>
          Upload your first document before asking questions.
        </p>

        <button onClick={() => setCurrentPage("documents")}>
          Upload document
        </button>
      </main>
    );
  }

  return (
    <main className="chat-page">
      <div className="chat-heading">
        <h1>
          Ask me anything about{" "}
          <input
            className="subject-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </h1>

        <select
          className="document-selector"
          value={selectedDocumentId}
          onChange={handleDocumentChange}
        >
          {documents.map((document) => (
            <option
              key={document.id}
              value={document.id}
            >
              {document.filename}
            </option>
          ))}
        </select>
      </div>

      {answer && (
        <Solution
            answer={answer}
            annotations={annotations}
            setAnnotations={setAnnotations}
            documentId={selectedDocumentId}
        />
)}

      <div className="chat-input">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleAsk();
            }
          }}
          placeholder="Ask a question..."
        />

        <button
          onClick={handleAsk}
          disabled={loading}
        >
          {loading ? "…" : "✎"}
        </button>
      </div>
    </main>
  );
}