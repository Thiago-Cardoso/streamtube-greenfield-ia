import { notFound } from 'next/navigation';
import { VideoPlayer } from '@/components/videos/video-player';
import { ProcessingStatus } from '@/components/videos/processing-status';

interface VideoMeta {
  id: string;
  slug: string;
  title: string | null;
  status: string;
  duration: number | null;
  size: number | null;
  mime_type: string | null;
  created_at: string;
}

async function fetchVideo(slug: string): Promise<VideoMeta | null> {
  const backendUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
  const res = await fetch(`${backendUrl}/videos/${slug}`, { cache: 'no-store' });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);

  return res.json() as Promise<VideoMeta>;
}

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const video = await fetchVideo(slug);

  if (!video) notFound();

  if (video.status !== 'READY') {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <ProcessingStatus slug={slug} status={video.status} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <VideoPlayer
        slug={video.slug}
        title={video.title}
        duration={video.duration}
        createdAt={video.created_at}
      />
    </main>
  );
}
