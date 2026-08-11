// ============================================================
// TRACEPOINT — Cloudinary API Client Proxy
// Calls /api/cloudinary server-side route to keep credentials safe.
// ============================================================

/**
 * Upload a photo file to Cloudinary via the server proxy.
 * Returns { url, public_id } or null on any failure. Never throws.
 */
export async function uploadPhoto(
  file: File
): Promise<{ url: string; public_id: string } | null> {
  if (!file) return null;

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/cloudinary', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error(`[Cloudinary Proxy] Upload returned status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.warn(`[Cloudinary Proxy] ${data.error}`);
      return null;
    }

    return {
      url: data.url as string,
      public_id: data.public_id as string,
    };
  } catch (err) {
    console.error('[Cloudinary Proxy] Upload failed:', err);
    return null;
  }
}

/**
 * Get a signed upload signature and params for direct client-to-Cloudinary uploads.
 * Returns the signature payload or null on any failure. Never throws.
 */
export async function getUploadSignature(): Promise<{
  signature: string;
  timestamp: string;
  public_id: string;
  cloud_name: string;
  api_key: string;
  folder: string;
} | null> {
  try {
    const response = await fetch('/api/cloudinary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signature' }),
    });

    if (!response.ok) {
      console.error(`[Cloudinary Proxy] Signature returned status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.warn(`[Cloudinary Proxy] ${data.error}`);
      return null;
    }

    return {
      signature: data.signature as string,
      timestamp: data.timestamp as string,
      public_id: '', // Server generates per-upload; client can supply if needed
      cloud_name: data.cloud_name as string,
      api_key: data.api_key as string,
      folder: data.folder as string,
    };
  } catch (err) {
    console.error('[Cloudinary Proxy] Signature failed:', err);
    return null;
  }
}

/**
 * Compare two uploaded images by face similarity via Cloudinary's AI.
 * Returns { similarity: number } (0–1) or null on any failure. Never throws.
 */
export async function compareFaces(
  image1PublicId: string,
  image2PublicId: string
): Promise<{ similarity: number } | null> {
  if (!image1PublicId || !image2PublicId) return null;

  try {
    const response = await fetch('/api/cloudinary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'compare',
        image1_public_id: image1PublicId,
        image2_public_id: image2PublicId,
      }),
    });

    if (!response.ok) {
      console.error(`[Cloudinary Proxy] Compare returned status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.warn(`[Cloudinary Proxy] ${data.error}`);
      return null;
    }

    return {
      similarity: typeof data.similarity === 'number' ? data.similarity : 0,
    };
  } catch (err) {
    console.error('[Cloudinary Proxy] Compare failed:', err);
    return null;
  }
}
