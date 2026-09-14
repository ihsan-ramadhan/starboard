import { useApp } from "../App";
import ImportWizard from "../components/ImportWizard";
import { useT } from "../lib/i18n";

export default function ImportPage() {
  const t = useT();
  const { user, refreshDatasets, importState, setImportState } = useApp();

  return (
    <main className="content">
      <div className="import-container">
        <div className="import-card">
          <h2>{t("import.pageTitle")}</h2>
          <p className="import-sub">
            {t("import.pageSub", { dept: user.role })}
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
