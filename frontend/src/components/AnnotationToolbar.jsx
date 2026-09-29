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
  onCancel,
}) {
  const [type, setType] = useState("underline");
  const [color, setColor] = useState(COLORS[0].value);
  const [underlineStyle, setUnderlineStyle] =
    useState("straight");

  return (
    <div
      className="annotation-toolbar"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="annotation-types">
        <button
          className={type === "underline" ? "selected" : ""}
          onClick={() => setType("underline")}
        >
          Underline
        </button>

        <button
          className={type === "highlight" ? "selected" : ""}
          onClick={() => setType("highlight")}
        >
          Highlight
        </button>
      </div>

      {type === "underline" && (
        <div className="underline-options">
          <button
            className={
              underlineStyle === "straight"
                ? "selected"
                : ""
            }
            onClick={() => setUnderlineStyle("straight")}
          >
            Straight
          </button>

          <button
            className={
              underlineStyle === "wavy"
                ? "selected"
                : ""
            }
            onClick={() => setUnderlineStyle("wavy")}
          >
            Wavy
          </button>
        </div>
      )}

      <div className="color-options">
        {COLORS.map((item) => (
          <button
            key={item.name}
            className={
              color === item.value
                ? "color-circle active"
                : "color-circle"
            }
            style={{ backgroundColor: item.value }}
            onClick={() => setColor(item.value)}
          />
        ))}
      </div>

      <div className="annotation-actions">
        <button onClick={onCancel}>Cancel</button>

        <button
          className="apply-button"
          onClick={() =>
            onApply({
              type,
              color,
              underlineStyle,
            })
          }
        >
          Apply
        </button>
      </div>
    </div>
  );
}