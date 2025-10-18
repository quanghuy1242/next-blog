export interface DirectiveChild {
  value?: string;
  [key: string]: unknown;
}

export interface DirectiveNode {
  type: string;
  name: string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  children: DirectiveChild[];
  data?: {
    parsed?: boolean;
    hName?: string;
    hProperties?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
