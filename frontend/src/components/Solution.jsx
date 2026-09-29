import { useState } from "react";
import AnnotationToolbar from "./AnnotationToolbar";
import InlineQnA from "./InlineQnA";

export default function Solution({
  answer,
  annotations,
  setAnnotations,
  documentId,
}) {
  const [selection, setSelection] = useState(null);

  const paragraphs = answer
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim());

  function handleSelection(event, paragraphIndex) {
    const browserSelection = window.getSelection();

    if (
      !browserSelection ||
      browserSelection.isCollapsed ||
      !browserSelection.toString().trim()
    ) {
      return;
    }

    const range = browserSelection.getRangeAt(0);

    const paragraphElement =
      event.currentTarget;

    if (
      !paragraphElement.contains(range.startContainer) ||
      !paragraphElement.contains(range.endContainer)
    ) {
      return;
    }

    const beforeSelection = document.createRange();

    beforeSelection.selectNodeContents(paragraphElement);

    beforeSelection.setEnd(
      range.startContainer,
      range.startOffset
    );

    const start = beforeSelection.toString().length;
    const text = range.toString();
    const end = start + text.length;

    const rect = range.getBoundingClientRect();

    setSelection({
      paragraphIndex,
      start,
      end,
      text,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top - 12,
      },
    });
  }

  function applyAnnotation(options) {
    if (!selection) return;

    const overlaps = annotations.some(
      (annotation) =>
        annotation.paragraphIndex ===
          selection.paragraphIndex &&
        selection.start < annotation.end &&
        selection.end > annotation.start
    );

    if (overlaps) {
      alert("This text already has an annotation.");
      return;
    }

    setAnnotations([
      ...annotations,
      {
        id: crypto.randomUUID(),
        paragraphIndex: selection.paragraphIndex,
        start: selection.start,
        end: selection.end,
        text: selection.text,
        type: options.type,
        color: options.color,
        underlineStyle: options.underlineStyle,
        expanded: true,
        messages: [],
      },
    ]);

    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }
  function addQnAMessage(annotationId, message) {
  setAnnotations(
    annotations.map((annotation) =>
      annotation.id === annotationId
        ? {
            ...annotation,
            messages: [
              ...annotation.messages,
              message,
            ],
          }
        : annotation
    )
  );
}
  function toggleHighlight(annotationId) {
    setAnnotations(
      annotations.map((annotation) =>
        annotation.id === annotationId
          ? {
              ...annotation,
              expanded: !annotation.expanded,
            }
          : annotation
      )
    );
  }

  function renderParagraph(text, paragraphIndex) {
    const paragraphAnnotations = annotations
      .filter(
        (annotation) =>
          annotation.paragraphIndex === paragraphIndex
      )
      .sort((a, b) => a.start - b.start);

    if (paragraphAnnotations.length === 0) {
      return text;
    }

    const pieces = [];
    let currentIndex = 0;

    paragraphAnnotations.forEach((annotation) => {
      pieces.push(
        text.slice(currentIndex, annotation.start)
      );

      const annotatedText = text.slice(
        annotation.start,
        annotation.end
      );

      if (annotation.type === "underline") {
        pieces.push(
          <span
            key={annotation.id}
            className="user-underline"
            style={{
              textDecorationLine: "underline",
              textDecorationStyle:
                annotation.underlineStyle === "wavy"
                  ? "wavy"
                  : "solid",
              textDecorationColor: annotation.color,
              textDecorationThickness: "2px",
              textUnderlineOffset: "4px",
            }}
          >
            {annotatedText}
          </span>
        );
      } else {
        pieces.push(
          <span
            key={annotation.id}
            className="qna-highlight"
            style={{
              backgroundColor: annotation.color,
            }}
            onClick={() =>
              toggleHighlight(annotation.id)
            }
          >
            {annotatedText}
          </span>
        );
      }

      currentIndex = annotation.end;
    });

    pieces.push(text.slice(currentIndex));

    return pieces;
  }

  return (
    <>
      <section className="solution">
        {paragraphs.map((paragraph, index) => (
          <div key={index}>
            <p
              className="solution-paragraph"
              onMouseUp={(event) =>
                handleSelection(event, index)
              }
            >
              {renderParagraph(paragraph, index)}
            </p>

            {annotations
              .filter(
                (annotation) =>
                  annotation.paragraphIndex === index &&
                  annotation.type === "highlight" &&
                  annotation.expanded
              )
              .map((annotation) => (
                <InlineQnA
                    key={`${annotation.id}-qna`}
                    annotation={annotation}
                    documentId={documentId}
                    onAddMessage={addQnAMessage}
                    />
              ))}
          </div>
        ))}
      </section>

      {selection && (
        <AnnotationToolbar
          position={selection.position}
          onApply={applyAnnotation}
          onCancel={() => setSelection(null)}
        />
      )}
    </>
  );
}