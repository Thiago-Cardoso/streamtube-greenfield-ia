import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test-utils/render';
import { UploadForm } from './upload-form';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/upload',
}));

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn((selector: (s: { user: null; accessToken: string; isInitialized: boolean }) => unknown) =>
    selector({ user: null, accessToken: 'mock-token', isInitialized: true }),
  ),
  getAuthState: () => ({ accessToken: 'mock-token' }),
}));

function makeXhr(overrides: Partial<{
  status: number;
  responseText: string;
  triggerProgress: boolean;
}> = {}) {
  const { status = 201, responseText = JSON.stringify({ slug: 'abc12345678' }), triggerProgress = false } = overrides;

  const xhrInstance = {
    open: vi.fn(),
    send: vi.fn().mockImplementation(function (this: typeof xhrInstance) {
      if (triggerProgress && this.upload?.onprogress) {
        this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
      }
      if (this.onload) {
        this.onload({} as ProgressEvent);
      }
    }),
    setRequestHeader: vi.fn(),
    upload: { onprogress: null as ((e: ProgressEvent) => void) | null },
    onload: null as ((e: ProgressEvent) => void) | null,
    onerror: null as ((e: ProgressEvent) => void) | null,
    status,
    responseText,
  };

  vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhrInstance));

  return xhrInstance;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPush.mockClear();
});

describe('UploadForm', () => {
  it('renders a file input and upload button', () => {
    render(<UploadForm />);
    expect(screen.getByLabelText(/video file/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('shows a progress bar after selecting a file and submitting', async () => {
    makeXhr({ triggerProgress: true });

    render(<UploadForm />);

    const input = screen.getByLabelText(/video file/i);
    const file = new File(['fake video'], 'test.mp4', { type: 'video/mp4' });
    await userEvent.upload(input, file);

    fireEvent.submit(screen.getByRole('button', { name: /upload/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('redirects to /watch/:slug on successful upload', async () => {
    makeXhr({ status: 201, responseText: JSON.stringify({ slug: 'abc12345678' }) });

    render(<UploadForm />);

    const input = screen.getByLabelText(/video file/i);
    const file = new File(['fake video'], 'test.mp4', { type: 'video/mp4' });
    await userEvent.upload(input, file);

    fireEvent.submit(screen.getByRole('button', { name: /upload/i }).closest('form')!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/watch/abc12345678');
    });
  });

  it('displays an error message on failed upload', async () => {
    makeXhr({
      status: 400,
      responseText: JSON.stringify({ message: 'File type not supported.' }),
    });

    render(<UploadForm />);

    const input = screen.getByLabelText(/video file/i);
    const file = new File(['fake video'], 'test.mp4', { type: 'video/mp4' });
    await userEvent.upload(input, file);

    fireEvent.submit(screen.getByRole('button', { name: /upload/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('File type not supported.');
    });
  });
});
