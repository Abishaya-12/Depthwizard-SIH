import { DemProcessingResponse } from './types';

export async function processDemFiles(
  relativeDem: File,
  absoluteDem: File,
): Promise<DemProcessingResponse> {
  const formData = new FormData();
  formData.append('relative_dem', relativeDem);
  formData.append('absolute_dem', absoluteDem);

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
