import { DemProcessingResponse } from './types';

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
