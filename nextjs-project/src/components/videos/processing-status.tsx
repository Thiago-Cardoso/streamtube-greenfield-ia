'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ProcessingStatusProps {
  slug: string;
  status: string;
}

export function ProcessingStatus({ slug, status }: ProcessingStatusProps) {
  const router = useRouter();

  useEffect(() => {
    if (status === 'FAILED') return;

    const id = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(id);
  }, [router, status]);

  if (status === 'FAILED') {
    return (
      <p role="alert" className="text-red-600">
        Video processing failed. Please try uploading again.
      </p>
    );
  }

  return (
    <p className="text-gray-600">
      Processing… your video will be ready shortly.
    </p>
  );
}
