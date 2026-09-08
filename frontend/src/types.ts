export type TabId = 
  | 'welcome-portal' 
  | 'setup-upload' 
  | 'map-generated' 
  | '3d-dem-viewer' 
  | '3d-flythrough';

export interface IngestionFile {
  name: string;
  size: string;
  verified: boolean;
  format: string;
  hash?: string;
  anchorLocked?: boolean;
}

export interface DemProcessingResponse {
  jobId: string;
  status: 'complete';
  relative: IngestionFile & {
    bytes: number;
    sha256: string;
    width: number | null;
    height: number | null;
    bands: number | null;
  };
  absolute: IngestionFile & {
    bytes: number;
    sha256: string;
    width: number | null;
    height: number | null;
    bands: number | null;
  };
  result: {
    meshTriangles: number;
    surveyAreaKm2: number;
    maxReliefMeters: number;
    interpolation: string;
    resolution: string;
  };
}
