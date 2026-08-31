import { useApp } from "../App";
import ImportWizard from "../components/ImportWizard";

export default function ImportPage() {
  const { user, refreshDatasets, importState, setImportState } = useApp();

  return (
    <main className="content">
      <div className="import-container">
        <div className="import-card">
          <h2>Import Dataset Baru</h2>
          <p className="import-sub">
            Upload file Excel (.xlsx) untuk departemen <strong>{user.role}</strong>.
            Sistem akan otomatis mendeteksi kolom, membuat tabel database, dan
            menambahkan menu baru ke dashboard.
          </p>

          <ImportWizard
            wizardState={importState}
            setWizardState={setImportState}
            onImportSuccess={refreshDatasets}
          />
        </div>
      </div>
    </main>
  );
}
