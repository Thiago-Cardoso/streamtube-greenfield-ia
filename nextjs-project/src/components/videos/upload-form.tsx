'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthState } from '@/store/auth.store';

export function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    const { accessToken } = getAuthState();
    const formData = new FormData();
    formData.append('video', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 201) {
        const body = JSON.parse(xhr.responseText) as { slug: string };
        router.push(`/watch/${body.slug}`);
      } else {
        let message = 'Upload failed';
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string };
          if (body.message) message = body.message;
        } catch {}
        setError(message);
        setIsUploading(false);
        setProgress(null);
      }
    };

    xhr.onerror = () => {
      setError('Upload failed. Please try again.');
      setIsUploading(false);
      setProgress(null);
    };

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
    xhr.open('POST', `${apiUrl}/videos`);
    if (accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    }

    setIsUploading(true);
    setError(null);
    xhr.send(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="video-input" className="block text-sm font-medium">
          Video file
        </label>
        <input
          id="video-input"
          ref={fileInputRef}
          type="file"
          accept="video/*"
          required
          disabled={isUploading}
          className="block w-full text-sm"
        />
      </div>

      {progress !== null && (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
          className="h-2 w-full rounded bg-gray-200"
        >
          <div
            className="h-2 rounded bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isUploading}
        className="rounded bg-blue-600 px-6 py-2 text-white disabled:opacity-50"
      >
        {isUploading ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}
