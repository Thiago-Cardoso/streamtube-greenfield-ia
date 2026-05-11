import { UploadForm } from '@/components/videos/upload-form';

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-8 text-2xl font-bold">Upload Video</h1>
      <UploadForm />
    </main>
  );
}
