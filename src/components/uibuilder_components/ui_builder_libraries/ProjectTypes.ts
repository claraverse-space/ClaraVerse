import { Message } from '../../../db/index';
export type { Message };

export interface UIBuilderDesign {
  id: string;
  name: string;
  description?: string;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  isDeleted?: boolean;
  version: number;
}

export interface UIBuilderDesignVersion {
  id: string;
  designId: string;
  versionNumber: number;
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  messages: Message[];
  createdAt: string;
  description?: string;
} 