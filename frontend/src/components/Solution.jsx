import { useRef, useState } from "react";

import AnnotationToolbar from "./AnnotationToolbar";
import InlineQnA from "./InlineQnA";


function parseBoldMarkdown(markdown) {
  let plainText = "";
  const boldRanges = [];

  let index = 0;

  while (index < markdown.length) {
    if (
      markdown.startsWith("**", index)
    ) {
      const closingIndex =
        markdown.indexOf(
          "**",
          index + 2
        );

      if (closingIndex !== -1) {
        const boldText =
          markdown.slice(
            index + 2,
            closingIndex
          );

        const start =
          plainText.length;

        plainText += boldText;

        boldRanges.push({
          start,
          end: plainText.length,
        });

        index =
          closingIndex + 2;

        continue;
      }
    }

    plainText += markdown[index];
    index += 1;
  }

  return {
    plainText,
    boldRanges,
  };
}


function rangeContains(
  range,
  position
) {
  return (
    position >= range.start &&
    position < range.end
  );
}


function rangesOverlap(
  firstStart,
  firstEnd,
  secondStart,
  secondEnd
) {
  return (
    firstStart < secondEnd &&
    firstEnd > secondStart
  );
}


export default function Solution({
  answer,
  annotations,
  setAnnotations,
  documentId,
}) {
  const solutionCardRef = useRef(null);

  const [selection, setSelection] =
    useState(null);


  const paragraphs = answer
    .split(/\n\s*\n/)
    .filter(
      (paragraph) =>
        paragraph.trim()
    );


  function clearSelection() {
    window
      .getSelection()
      ?.removeAllRanges();

    setSelection(null);
  }


  function handleSelection(
    event,
    paragraphIndex
  ) {
    const browserSelection =
      window.getSelection();

    if (
      !browserSelection ||
      browserSelection.isCollapsed ||
      !browserSelection
        .toString()
        .trim()
    ) {
      return;
    }

    const range =
      browserSelection.getRangeAt(0);

    const paragraphElement =
      event.currentTarget;

    if (
      !paragraphElement.contains(
        range.commonAncestorContainer
      )
    ) {
      return;
    }


    const beforeSelection =
      document.createRange();

    beforeSelection.selectNodeContents(
      paragraphElement
    );

    beforeSelection.setEnd(
      range.startContainer,
      range.startOffset
    );


    const start =
      beforeSelection
        .toString()
        .length;

    const text =
      browserSelection.toString();

    const end =
      start + text.length;


    const selectionRect =
      range.getBoundingClientRect();

    const cardRect =
      solutionCardRef.current
        ?.getBoundingClientRect();


    if (!cardRect) return;


    /*
      Toolbar is positioned relative to the solution card,
      not the whole browser window.

      We also clamp X so the toolbar stays inside the card.
    */
    const toolbarHalfWidth = 150;

    const rawX =
      selectionRect.left +
      selectionRect.width / 2 -
      cardRect.left;

    const x = Math.max(
      toolbarHalfWidth,
      Math.min(
        rawX,
        cardRect.width -
          toolbarHalfWidth
      )
    );

    const y =
      selectionRect.bottom -
      cardRect.top +
      10;


    const canRemove =
      annotations.some(
        (annotation) =>
          annotation.paragraphIndex ===
            paragraphIndex &&
          rangesOverlap(
            start,
            end,
            annotation.start,
            annotation.end
          )
      );


    setSelection({
      paragraphIndex,
      start,
      end,
      text,
      x,
      y,
      canRemove,
    });
  }


  function applyAnnotation({
    type,
    color,
    underlineStyle,
  }) {
    if (!selection) return;


    const overlaps =
      annotations.some(
        (annotation) =>
          annotation.paragraphIndex ===
            selection.paragraphIndex &&
          rangesOverlap(
            selection.start,
            selection.end,
            annotation.start,
            annotation.end
          )
      );


    /*
      Prevent overlapping annotations.
      If there is already one here, the toolbar gives
      the user an explicit "Remove annotation" button.
    */
    if (overlaps) {
      return;
    }


    const newAnnotation = {
      id: crypto.randomUUID(),
      paragraphIndex:
        selection.paragraphIndex,
      start: selection.start,
      end: selection.end,
      text: selection.text,
      type,
      color,
      underlineStyle,
      expanded:
        type === "highlight",
      messages: [],
    };


    setAnnotations((current) => [
      ...current,
      newAnnotation,
    ]);


    clearSelection();
  }


  function removeSelectedAnnotations() {
    if (!selection) return;


    setAnnotations((current) =>
      current.filter(
        (annotation) =>
          !(
            annotation.paragraphIndex ===
              selection.paragraphIndex &&
            rangesOverlap(
              selection.start,
              selection.end,
              annotation.start,
              annotation.end
            )
          )
      )
    );


    clearSelection();
  }


  function toggleHighlight(
    annotationId
  ) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id ===
        annotationId
          ? {
              ...annotation,
              expanded:
                !annotation.expanded,
            }
          : annotation
      )
    );
  }


  function addQnAMessage(
    annotationId,
    message
  ) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id ===
        annotationId
          ? {
              ...annotation,
              messages: [
                ...(
                  annotation.messages ||
                  []
                ),
                message,
              ],
            }
          : annotation
      )
    );
  }


  function renderParagraph(
    rawParagraph,
    paragraphIndex
  ) {
    const {
      plainText,
      boldRanges,
    } = parseBoldMarkdown(
      rawParagraph
    );


    const paragraphAnnotations =
      annotations
        .filter(
          (annotation) =>
            annotation.paragraphIndex ===
            paragraphIndex
        )
        .sort(
          (a, b) =>
            a.start - b.start
        );


    const boundaries = new Set([
      0,
      plainText.length,
    ]);


    boldRanges.forEach((range) => {
      boundaries.add(range.start);
      boundaries.add(range.end);
    });


    paragraphAnnotations.forEach(
      (annotation) => {
        boundaries.add(
          annotation.start
        );

        boundaries.add(
          annotation.end
        );
      }
    );


    const points = Array.from(
      boundaries
    )
      .filter(
        (point) =>
          point >= 0 &&
          point <=
            plainText.length
      )
      .sort(
        (a, b) => a - b
      );


    const pieces = [];


    for (
      let index = 0;
      index < points.length - 1;
      index += 1
    ) {
      const start = points[index];
      const end =
        points[index + 1];

      if (start === end) {
        continue;
      }

      const segment =
        plainText.slice(
          start,
          end
        );


      const annotation =
        paragraphAnnotations.find(
          (item) =>
            start >= item.start &&
            end <= item.end
        );


      const isBold =
        boldRanges.some(
          (range) =>
            rangeContains(
              range,
              start
            )
        );


      let content = isBold ? (
        <strong>
          {segment}
        </strong>
      ) : (
        segment
      );


      if (annotation) {
        if (
          annotation.type ===
          "highlight"
        ) {
          content = (
            <span
              className="solution-highlight"
              style={{
                backgroundColor:
                  annotation.color,
              }}
              title="Click to show or hide Quick Q&A"
              onClick={() =>
                toggleHighlight(
                  annotation.id
                )
              }
            >
              {content}
            </span>
          );
        } else {
          content = (
            <span
              className="solution-underline"
              style={
                annotation.underlineStyle === "wavy"
                  ? {
                      textDecorationLine: "underline",
                      textDecorationStyle: "wavy",
                      textDecorationColor: annotation.color,
                      textDecorationThickness: "2px",
                      textUnderlineOffset: "3px",
                    }
                  : {
                      borderBottom: `2px solid ${annotation.color}`,
                      paddingBottom: "1px",
                    }
              }
            >
              {content}
            </span>
          );
        }
      }


      pieces.push(
        <span
          key={`${start}-${end}`}
        >
          {content}
        </span>
      );
    }


    return pieces;
  }


  return (
    <div
      className="solution-card"
      ref={solutionCardRef}
    >

      <div className="annotation-guidance">
        <strong>
          Study tip:
        </strong>{" "}
        Select text and choose{" "}
        <strong>Highlight</strong>{" "}
        to open Quick Q&A. Click a
        highlight again to show or
        hide its Q&A.
      </div>


      {paragraphs.map(
        (
          paragraph,
          paragraphIndex
        ) => {
          const highlights =
            annotations.filter(
              (annotation) =>
                annotation.paragraphIndex ===
                  paragraphIndex &&
                annotation.type ===
                  "highlight"
            );


          return (
            <div
              key={paragraphIndex}
              className="solution-paragraph-block"
            >

              <p
                className="solution-paragraph"
                onMouseUp={(event) =>
                  handleSelection(
                    event,
                    paragraphIndex
                  )
                }
              >
                {renderParagraph(
                  paragraph,
                  paragraphIndex
                )}
              </p>


              {highlights.map(
                (annotation) =>
                  annotation.expanded ? (
                    <InlineQnA
                      key={annotation.id}
                      annotation={
                        annotation
                      }
                      documentId={
                        documentId
                      }
                      onAddMessage={(
                        message
                      ) =>
                        addQnAMessage(
                          annotation.id,
                          message
                        )
                      }
                      onCollapse={() =>
                        toggleHighlight(
                          annotation.id
                        )
                      }
                    />
                  ) : null
              )}

            </div>
          );
        }
      )}


      {selection && (
        <AnnotationToolbar
          position={{
            x: selection.x,
            y: selection.y,
          }}
          onApply={
            applyAnnotation
          }
          onRemove={
            removeSelectedAnnotations
          }
          onClose={
            clearSelection
          }
          canRemove={
            selection.canRemove
          }
        />
      )}

    </div>
  );
}
