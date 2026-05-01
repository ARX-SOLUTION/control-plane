export interface BuildImageOpts {
  contextPath: string;
  imageName: string;
  buildArgs?: Record<string, string>;
  onLog?: (line: string) => void;
}

export interface CreateContainerOpts {
  imageName: string;
  containerName: string;
  envVars: Record<string, string>;
  networkName: string;
  command?: string[];
}
