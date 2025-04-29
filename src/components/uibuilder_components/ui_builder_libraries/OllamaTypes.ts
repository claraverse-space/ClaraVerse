// Ollama API response types

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaModelList {
  models: OllamaModel[];
}

export interface OllamaGenerationOptions {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  format?: 'json';
  options?: {
    num_predict?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    tfs_z?: number;
    typical_p?: number;
    repeat_penalty?: number;
    repeat_last_n?: number;
    seed?: number;
    stop?: string[];
    num_gpu?: number;
    mirostat?: number;
    mirostat_eta?: number;
    mirostat_tau?: number;
    num_thread?: number;
    num_ctx?: number;
    num_batch?: number;
    num_keep?: number;
    numa?: boolean;
    penalize_newline?: boolean;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  context?: number[];
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaConnection {
  host: string;
  port: number;
  secure: boolean;
} 