import { useState } from "react";

import { quickAsk } from "../api";


const QUICK_ACTIONS = [
  {
    action: "why",
    label: "Why?",
  },
  {
    action: "explain_more",
    label: "Explain more",
  },
  {
    action: "simplify",
    label: "Simplify",
  },
  {
    action: "example",
    label: "Give example",
  },
];


export default function InlineQnA({
  annotation,
  documentId,
  onAddMessage,
  onCollapse,
}) {
  const [question, setQuestion] =
    useState("");

  const [loading, setLoading] =
    useState(false);


  async function ask({
    action = null,
    customQuestion = null,
  }) {
    if (
      !action &&
      !customQuestion?.trim()
    ) {
      return;
    }

    setLoading(true);

    try {
      const result = await quickAsk({
        selectedText:
          annotation.text,
        action,
        question:
          customQuestion,
        documentId,
      });

      onAddMessage({
        id: crypto.randomUUID(),
        question:
          customQuestion ||
          QUICK_ACTIONS.find(
            (item) =>
              item.action === action
          )?.label ||
          "Quick Q&A",
        answer: result.answer,
      });

      setQuestion("");
    } catch (error) {
      console.error(
        "Quick Q&A failed:",
        error
      );
    } finally {
      setLoading(false);
    }
  }


  const messages =
    annotation.messages || [];


  return (
    <div className="inline-qna">

      <div className="inline-qna-header">

        <div>
          <strong>Quick Q&A</strong>

        </div>

        <button
          className="inline-qna-hide"
          onClick={onCollapse}
        >
          Hide
        </button>

      </div>


      <div className="quick-action-row">

        {QUICK_ACTIONS.map(
          (item) => (
            <button
              key={item.action}
              onClick={() =>
                ask({
                  action:
                    item.action,
                })
              }
              disabled={loading}
            >
              {item.label}
            </button>
          )
        )}

      </div>


      {messages.map(
        (message) => (
          <div
            key={message.id}
            className="inline-qna-message"
          >

            <div className="inline-qna-question">
              {message.question}
            </div>

            <div className="inline-qna-answer">
              {message.answer}
            </div>

          </div>
        )
      )}


      <div className="inline-qna-input-row">

        <input
          value={question}
          onChange={(event) =>
            setQuestion(
              event.target.value
            )
          }
          placeholder="Ask about this highlight..."
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              question.trim() &&
              !loading
            ) {
              ask({
                customQuestion:
                  question,
              });
            }
          }}
        />

        <button
          onClick={() =>
            ask({
              customQuestion:
                question,
            })
          }
          disabled={
            loading ||
            !question.trim()
          }
        >
          {loading
            ? "..."
            : "Ask"}
        </button>

      </div>

    </div>
  );
}
