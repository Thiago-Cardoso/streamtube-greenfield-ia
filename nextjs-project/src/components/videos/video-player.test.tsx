import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test-utils/render';
import { VideoPlayer } from './video-player';

const API_URL = 'http://localhost:3100';
const SLUG = 'abc12345678';

describe('VideoPlayer', () => {
  it('renders a video element with correct src and poster attributes', () => {
    const { container } = render(
      <VideoPlayer slug={SLUG} title="My Video" duration={90} createdAt="2024-01-15T00:00:00Z" />,
    );

    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.src).toContain(`/videos/${SLUG}/stream`);
    expect(video.poster).toContain(`/videos/${SLUG}/thumbnail`);
  });

  it('renders the title when provided', () => {
    render(
      <VideoPlayer slug={SLUG} title="My Video" duration={null} createdAt="2024-01-15T00:00:00Z" />,
    );
    expect(screen.getByRole('heading', { name: 'My Video' })).toBeInTheDocument();
  });

  it('falls back to slug when title is null', () => {
    render(
      <VideoPlayer slug={SLUG} title={null} duration={null} createdAt="2024-01-15T00:00:00Z" />,
    );
    expect(screen.getByRole('heading', { name: SLUG })).toBeInTheDocument();
  });

  it('formats and displays the duration', () => {
    render(
      <VideoPlayer slug={SLUG} title={null} duration={90} createdAt="2024-01-15T00:00:00Z" />,
    );
    expect(screen.getByText(/1:30/)).toBeInTheDocument();
  });

  it('renders a download link with correct href and download attribute', () => {
    render(
      <VideoPlayer slug={SLUG} title={null} duration={null} createdAt="2024-01-15T00:00:00Z" />,
    );

    const link = screen.getByRole('link', { name: /download/i }) as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.href).toContain(`/videos/${SLUG}/download`);
    expect(link).toHaveAttribute('download');
  });
});
