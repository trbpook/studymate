export default function Sidebar({
  currentPage,
  setCurrentPage,
}) {
  return (
    <aside className="sidebar">

      <div className="sidebar-logo">
        Studymate
      </div>

      <nav className="sidebar-nav">

        <button
          className={
            currentPage === "chat"
              ? "active"
              : ""
          }
          onClick={() =>
            setCurrentPage("chat")
          }
        >
          Chat
        </button>

        <button
          className={
            currentPage === "documents"
              ? "active"
              : ""
          }
          onClick={() =>
            setCurrentPage("documents")
          }
        >
          Documents
        </button>

        <button
          className={
            currentPage === "revision"
              ? "active"
              : ""
          }
          onClick={() =>
            setCurrentPage("revision")
          }
        >
          Revision
        </button>

      </nav>

    </aside>
  );
}