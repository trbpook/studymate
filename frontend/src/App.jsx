import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatPage from "./pages/ChatPage";
import DocumentsPage from "./pages/DocumentsPage";
import "./App.css";

function App() {
  const [currentPage, setCurrentPage] = useState("chat");

  return (
    <div className="app">
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />

      {currentPage === "chat" && (
        <ChatPage setCurrentPage={setCurrentPage} />
      )}

      {currentPage === "documents" && (
        <DocumentsPage />
      )}

      {currentPage === "revision" && (
        <div>Revision page coming next</div>
      )}
    </div>
  );
}

export default App;