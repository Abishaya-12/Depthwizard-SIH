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
  relative?: IngestionFile & {
    bytes: number;
    sha256: string;
    width: number | null;
    height: number | null;
    bands: number | null;
  } | null;
  absolute?: IngestionFile & {
    bytes: number;
    sha256: string;
    width: number | null;
    height: number | null;
    bands: number | null;
  } | null;
  previewImage?: string | null;
  result: {
    calibrated: boolean;
    meshTriangles: number;
    surveyAreaKm2?: number;
    minElevationMeters?: number;
    maxElevationMeters?: number;
    meanElevationMeters?: number;
    maxReliefMeters?: number;
    interpolation?: string;
    resolution?: string;
  };
  calibratedDemUrl?: string;
}
