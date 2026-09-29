export default function Sidebar({
  currentPage,
  setCurrentPage,
}) {
  const pages = [
    ["chat", "Chat"],
    ["documents", "Documents"],
    ["revision", "Revision"],
  ];

  return (
    <aside className="sidebar">
      <div className="logo">Studymate</div>

      {pages.map(([page, label]) => (
        <button
          key={page}
          className={currentPage === page ? "active" : ""}
          onClick={() => setCurrentPage(page)}
        >
          {label}
        </button>
      ))}
    </aside>
  );
}