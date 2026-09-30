import { useEffect, useState } from "react";

import {
  deleteDocument,
  getDocuments,
  getDownloadUrl,
  uploadDocument,
} from "../api";


export default function DocumentsPage() {
  const [documents, setDocuments] =
    useState([]);

  const [uploading, setUploading] =
    useState(false);


  async function loadDocuments() {
    try {
      const data = await getDocuments();

      setDocuments(data);
    } catch (error) {
      console.error(
        "Failed to load documents:",
        error
      );
    }
  }


  useEffect(() => {
    loadDocuments();
  }, []);


  async function handleUpload(event) {
    const file =
      event.target.files[0];

    if (!file) return;

    setUploading(true);

    try {
      await uploadDocument(file);

      await loadDocuments();
    } catch (error) {
      console.error(
        "Failed to upload document:",
        error
      );
    } finally {
      setUploading(false);

      event.target.value = "";
    }
  }


  async function handleDelete(
    documentId
  ) {
    const confirmed =
      window.confirm(
        "Delete this document?"
      );

    if (!confirmed) return;

    try {
      await deleteDocument(
        documentId
      );

      await loadDocuments();
    } catch (error) {
      console.error(
        "Failed to delete document:",
        error
      );
    }
  }


  return (
    <main className="documents-page">

      <div className="documents-header">

        <div>
          <h1>Documents</h1>

          <p>
            Upload and manage your
            study materials.
          </p>
        </div>


        <label className="upload-button">
          {uploading
            ? "Uploading..."
            : "Upload PDF"}

          <input
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
            hidden
          />
        </label>

      </div>


      {documents.length === 0 ? (
        <div className="documents-empty">

          <h2>No documents yet</h2>

          <p>
            Upload a PDF to start
            studying with Studymate.
          </p>

        </div>
      ) : (
        <div className="document-list">

          {documents.map(
            (document) => (
              <div
                className="document-row"
                key={document.id}
              >

                <div className="document-info">

                  <span className="document-name">
                    {document.alias ||
                      document.filename}
                  </span>

                  {document.alias && (
                    <span className="document-original-name">
                      {document.filename}
                    </span>
                  )}

                  {document.uploaded_at && (
                    <span className="document-date">
                      {new Date(
                        document.uploaded_at
                      ).toLocaleDateString()}
                    </span>
                  )}

                </div>


                <div className="document-actions">

                  <a
                    href={getDownloadUrl(
                      document.id
                    )}
                    className="document-action"
                  >
                    Download
                  </a>

                  <button
                    className="document-action delete-action"
                    onClick={() =>
                      handleDelete(
                        document.id
                      )
                    }
                  >
                    Delete
                  </button>

                </div>

              </div>
            )
          )}

        </div>
      )}

    </main>
  );
}
