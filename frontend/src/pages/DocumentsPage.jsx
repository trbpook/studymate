import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getDownloadUrl,
} from "../api";

async function handleDelete(documentId) {
  await deleteDocument(documentId);
  await loadDocuments();
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);

  async function loadDocuments() {
    const data = await getDocuments();
    setDocuments(data);
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function handleUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    setUploading(true);

    await uploadDocument(file);
    await loadDocuments();

    setUploading(false);
  }

  return (
    <main className="documents-page">
      <div className="documents-header">
        <h1>Documents</h1>

        <label className="upload-button">
          {uploading ? "Uploading..." : "Upload"}
          <input
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            hidden
          />
        </label>
      </div>

      <div className="document-list">
        {documents.map((document) => (
          <div className="document-row" key={document.id}>
            <span>{document.filename}</span>

            <div>
                <a href={getDownloadUrl(document.id)}>
                Download
                </a>

                <button onClick={() => handleDelete(document.id)}>
                Delete
                </button>
            </div>
            </div>
        ))}
      </div>
    </main>
  );
}

