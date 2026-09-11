import { DemProcessingResponse } from './types';

interface DepthEstimationResponse {
  relativeDemUrl: string;
  jobId: string;
}

export async function estimateDepthFromImage(image: File): Promise<DepthEstimationResponse> {
  const formData = new FormData();
  formData.append('rgb_image', image);

  const response = await fetch('/api/estimate-depth', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json()) as DepthEstimationResponse | { error?: string };
  if (!response.ok) {
    throw new Error('error' in payload && payload.error ? payload.error : 'Depth estimation failed.');
  }

  return payload as DepthEstimationResponse;
}

export async function processDemFiles(
  relativeDem?: File | null,
  absoluteDem?: File | null,
): Promise<DemProcessingResponse> {
  const formData = new FormData();
  if (relativeDem) formData.append('relative_dem', relativeDem);
  if (absoluteDem) formData.append('absolute_dem', absoluteDem);

  const response = await fetch('/api/process-dem', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json()) as DemProcessingResponse | { error?: string };
  if (!response.ok) {
    throw new Error('error' in payload && payload.error ? payload.error : 'DEM processing failed.');
  }

  return payload as DemProcessingResponse;
}
