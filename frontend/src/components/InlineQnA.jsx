import { useState } from "react";
import { quickAsk } from "../api";

export default function InlineQnA({
  annotation,
  documentId,
  onAddMessage,
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask({ action = null, customQuestion = null }) {
    setLoading(true);

    try {
      const result = await quickAsk({
        selectedText: annotation.text,
        action,
        question: customQuestion,
        documentId,
      });

      onAddMessage(annotation.id, {
        id: crypto.randomUUID(),
        question:
          customQuestion ||
          {
            why: "Why?",
            explain_more: "Explain more",
            simplify: "Simplify",
            example: "Give an example",
          }[action],
        answer: result.answer,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!question.trim()) return;

    const currentQuestion = question;
    setQuestion("");

    await ask({
      customQuestion: currentQuestion,
    });
  }

  return (
    <div className="inline-qna">
      {annotation.messages.length === 0 && (
        <>
          <div className="quick-actions">
            <button onClick={() => ask({ action: "why" })}>
              Why?
            </button>

            <button
              onClick={() => ask({ action: "explain_more" })}
            >
              Explain more
            </button>

            <button
              onClick={() => ask({ action: "simplify" })}
            >
              Simplify
            </button>

            <button onClick={() => ask({ action: "example" })}>
              Example
            </button>
          </div>
        </>
      )}

      <div className="qna-messages">
        {annotation.messages.map((message) => (
          <div className="qna-message" key={message.id}>
            <div className="qna-question">
              {message.question}
            </div>

            <div className="qna-answer">
              {message.answer}
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="qna-loading">
          Thinking…
        </div>
      )}

      <div className="qna-input">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSubmit();
            }
          }}
          placeholder="Ask about this..."
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
        >
          ↗
        </button>
      </div>
    </div>
  );
}