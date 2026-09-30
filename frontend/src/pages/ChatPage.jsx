import { useEffect, useState } from "react";

import {
  askQuestion,
  getDocuments,
  saveSolution,
  updateDocumentAlias,
} from "../api";

import Solution from "../components/Solution";


export default function ChatPage({
  setCurrentPage,
}) {
  const [documents, setDocuments] = useState([]);

  const [
    selectedDocumentId,
    setSelectedDocumentId,
  ] = useState(null);

  const [subject, setSubject] = useState("");
  const [aliasStatus, setAliasStatus] =
    useState("");

  const [question, setQuestion] =
    useState("");

  const [
    answeredQuestion,
    setAnsweredQuestion,
  ] = useState("");

  const [answer, setAnswer] = useState("");

  const [annotations, setAnnotations] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [saved, setSaved] =
    useState(false);


  useEffect(() => {
    async function loadDocuments() {
      try {
        const data = await getDocuments();

        setDocuments(data);

        if (data.length > 0) {
          const firstDocument = data[0];

          setSelectedDocumentId(
            firstDocument.id
          );

          setSubject(
            firstDocument.alias ||
            firstDocument.filename
          );
        }
      } catch (error) {
        console.error(
          "Failed to load documents:",
          error
        );
      }
    }

    loadDocuments();
  }, []);


  function handleDocumentChange(event) {
    const documentId = Number(
      event.target.value
    );

    setSelectedDocumentId(documentId);

    const selectedDocument =
      documents.find(
        (document) =>
          document.id === documentId
      );

    if (selectedDocument) {
      setSubject(
        selectedDocument.alias ||
        selectedDocument.filename
      );
    }

    setAliasStatus("");

    // Avoid showing an answer that belongs to
    // the previously selected document.
    setAnswer("");
    setAnsweredQuestion("");
    setAnnotations([]);
    setSaved(false);
  }


  async function saveAlias() {
    if (!selectedDocumentId) return;

    const selectedDocument =
      documents.find(
        (document) =>
          document.id ===
          selectedDocumentId
      );

    if (!selectedDocument) return;

    const trimmed = subject.trim();

    if (!trimmed) {
      setSubject(
        selectedDocument.alias ||
        selectedDocument.filename
      );

      return;
    }

    const currentName =
      selectedDocument.alias ||
      selectedDocument.filename;

    if (trimmed === currentName) {
      return;
    }

    try {
      setAliasStatus("Saving...");

      const updated =
        await updateDocumentAlias(
          selectedDocumentId,
          trimmed
        );

      setDocuments((current) =>
        current.map((document) =>
          document.id ===
          selectedDocumentId
            ? {
                ...document,
                alias: updated.alias,
              }
            : document
        )
      );

      setAliasStatus("Saved");
    } catch (error) {
      console.error(
        "Failed to save alias:",
        error
      );

      setAliasStatus(
        "Could not save"
      );
    }
  }


  async function handleAsk() {
    if (!question.trim()) return;

    const currentQuestion =
      question.trim();

    setLoading(true);

    try {
      const result =
        await askQuestion(
          currentQuestion,
          selectedDocumentId
        );

      setAnsweredQuestion(
        currentQuestion
      );

      setAnswer(result.answer);

      setAnnotations([]);

      setSaved(false);

      setQuestion("");
    } catch (error) {
      console.error(
        "Failed to ask question:",
        error
      );
    } finally {
      setLoading(false);
    }
  }


  async function handleSave() {
    if (
      !answer ||
      !answeredQuestion
    ) {
      return;
    }

    try {
      await saveSolution({
        question: answeredQuestion,
        answer,
        documentId:
          selectedDocumentId,
        annotations,
      });

      setSaved(true);
    } catch (error) {
      console.error(
        "Failed to save solution:",
        error
      );
    }
  }


  if (documents.length === 0) {
    return (
      <main className="chat-page">
        <div className="chat-empty-state">
          <h1>
            Add a document to start studying
          </h1>

          <p>
            Studymate answers questions using
            your own study material.
          </p>

          <button
            onClick={() =>
              setCurrentPage("documents")
            }
          >
            Upload document
          </button>
        </div>
      </main>
    );
  }


  return (
    <main className="chat-page">

      <div className="chat-heading">
        <span>
          Ask me anything about
        </span>

        <input
          className="subject-input"
          value={subject}
          onChange={(event) => {
            setSubject(
              event.target.value
            );

            setAliasStatus("");
          }}
          onBlur={saveAlias}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          aria-label="Document alias"
        />

        {aliasStatus && (
          <span className="alias-status">
            {aliasStatus}
          </span>
        )}
      </div>


      <select
        className="document-selector"
        value={
          selectedDocumentId || ""
        }
        onChange={
          handleDocumentChange
        }
      >
        {documents.map(
          (document) => (
            <option
              key={document.id}
              value={document.id}
            >
              {document.alias ||
                document.filename}
            </option>
          )
        )}
      </select>


      {answer && (
        <>
          <div className="question-label">
            {answeredQuestion}
          </div>

          <Solution
            answer={answer}
            annotations={annotations}
            setAnnotations={
              setAnnotations
            }
            documentId={
              selectedDocumentId
            }
          />

          <button
            className="save-revision-button"
            onClick={handleSave}
            disabled={saved}
          >
            {saved
              ? "Saved to Revision"
              : "Save for Revision"}
          </button>
        </>
      )}


      <div className="chat-input-bar">

        <input
          value={question}
          onChange={(event) =>
            setQuestion(
              event.target.value
            )
          }
          placeholder="Ask a question..."
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !loading
            ) {
              handleAsk();
            }
          }}
        />

        <button
          onClick={handleAsk}
          disabled={
            loading ||
            !question.trim()
          }
          aria-label="Send question"
        >
          {loading ? "..." : "✎"}
        </button>

      </div>

    </main>
  );
}
