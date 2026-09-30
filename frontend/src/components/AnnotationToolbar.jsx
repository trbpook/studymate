import { useState } from "react";


const COLORS = [
  { name: "yellow", value: "#f3df8b" },
  { name: "blue", value: "#a9d6e5" },
  { name: "green", value: "#b8d8ba" },
  { name: "pink", value: "#e8b4bc" },
  { name: "purple", value: "#cdb4db" },
];


export default function AnnotationToolbar({
  position,
  onApply,
  onRemove,
  onClose,
  canRemove,
}) {
  const [selectedColor, setSelectedColor] = useState(
    COLORS[0].value
  );

  const [showUnderlineStyles, setShowUnderlineStyles] =
    useState(false);


  function applyUnderline(underlineStyle) {
    onApply({
      type: "underline",
      color: selectedColor,
      underlineStyle,
    });
  }


  function applyHighlight() {
    onApply({
      type: "highlight",
      color: selectedColor,
      underlineStyle: "straight",
    });
  }


  return (
    <div
      className="annotation-toolbar"
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={(event) =>
        event.preventDefault()
      }
    >
      <button
        className="annotation-toolbar-close"
        onClick={onClose}
        aria-label="Close annotation toolbar"
        title="Close"
      >
        ×
      </button>


      <div className="annotation-toolbar-row">

        <div className="annotation-tool-group">
          <button
            className={
              showUnderlineStyles
                ? "annotation-tool-active"
                : ""
            }
            onClick={() =>
              setShowUnderlineStyles(
                (current) => !current
              )
            }
          >
            Underline
          </button>

          {showUnderlineStyles && (
            <div className="underline-style-menu">

              <button
                onClick={() =>
                  applyUnderline("straight")
                }
              >
                Straight
              </button>

              <button
                onClick={() =>
                  applyUnderline("wavy")
                }
              >
                Wavy
              </button>

            </div>
          )}
        </div>


        <button
          onClick={applyHighlight}
        >
          Highlight
        </button>

      </div>


      <div className="annotation-color-row">
        {COLORS.map((color) => (
          <button
            key={color.name}
            className={
              selectedColor === color.value
                ? "annotation-color selected"
                : "annotation-color"
            }
            style={{
              backgroundColor: color.value,
            }}
            onClick={() =>
              setSelectedColor(color.value)
            }
            title={color.name}
            aria-label={`Use ${color.name}`}
          />
        ))}
      </div>


      {canRemove && (
        <button
          className="annotation-remove-button"
          onClick={onRemove}
        >
          Remove annotation
        </button>
      )}

    </div>
  );
}
