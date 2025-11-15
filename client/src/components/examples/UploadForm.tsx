import UploadForm from '../UploadForm';
import { Toaster } from "@/components/ui/toaster";

export default function UploadFormExample() {
  return (
    <div className="p-6 bg-background">
      <UploadForm />
      <Toaster />
    </div>
  );
}
