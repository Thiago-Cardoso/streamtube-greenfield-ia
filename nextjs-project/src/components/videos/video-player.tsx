'use client';

interface VideoPlayerProps {
  slug: string;
  title: string | null;
  duration: number | null;
  createdAt: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoPlayer({ slug, title, duration, createdAt }: VideoPlayerProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  return (
    <div className="space-y-4">
      <video
        controls
        src={`${apiUrl}/videos/${slug}/stream`}
        poster={`${apiUrl}/videos/${slug}/thumbnail`}
        preload="metadata"
        className="w-full rounded bg-black"
        aria-label={title ?? slug}
      />

      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{title ?? slug}</h1>
        {duration !== null && (
          <p className="text-sm text-gray-500">Duration: {formatDuration(duration)}</p>
        )}
        <p className="text-sm text-gray-500">
          Uploaded: {new Date(createdAt).toLocaleDateString()}
        </p>
      </div>

      <a
        href={`${apiUrl}/videos/${slug}/download`}
        download
        className="inline-block rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
      >
        Download
      </a>
    </div>
  );
}
