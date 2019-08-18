export type Tagimo = {
  [key: string]: string;
};

export type FilePath = string;

export interface LogObj {
  file: FilePath;
  tags: Tagimo;
}
