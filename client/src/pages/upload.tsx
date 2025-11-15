import UploadForm from "@/components/UploadForm";

export default function Upload() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="heading-upload">Screenshots hochladen</h1>
        <p className="text-muted-foreground mb-8">
          Laden Sie Screenshots Ihrer Pionex-Bot-Ergebnisse hoch und geben Sie die Details manuell ein.
        </p>

        <UploadForm />
      </div>
    </div>
  );
}
