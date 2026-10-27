export type ActionCategory = 'AUTO' | 'CONTROLLER' | 'SERVICE' | 'REPOSITORY' | 'LLM';

export interface ArgumentDetail {
  name: string;
  type: string;
  value: unknown;
  sensitive: boolean;
}

export interface ReturnDetail {
  type: string;
  value: unknown;
  sensitive: boolean;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  depth: number;
  category: ActionCategory;
  name: string;
  class: string;
  method: string;
  thread: string;
  startTime: string;
  startNanos?: number;
  durationMs: number;
  offsetMs: number;
  offsetPct: number;
  widthPct: number;
  status: 'OK' | 'ERROR';
  args?: unknown;
  result?: unknown;
  inputArgs?: ArgumentDetail[];
  outputArgs?: ReturnDetail;
  error?: string | null;
  errorMessage?: string | null;
  errorDetail?: string | null;
}

export interface TraceRecord {
  traceId: string;
  name: string;
  category: ActionCategory;
  status: 'OK' | 'ERROR';
  startTime: string;
  startLabel: string;
  durationMs: number;
  spanCount: number;
  errorCount: number;
  dropped: number;
  error?: string | null;
  errorMessage?: string | null;
  errorDetail?: string | null;
  inputArgs?: ArgumentDetail[];
  outputArgs?: ReturnDetail;
  spans: Span[];
}

export interface ObservedEndpoint {
  id: string;
  method: string;
  path: string;
  controllerName: string;
  methodName: string;
  description: string;
  requestBodyType: string | null;
  sampleBody: string | null;
  sampleHeaders: Record<string, string>;
}

export interface SessionInfo {
  authenticated: boolean;
  title: string;
  username: string;
  role?: string;
  observe?: {
    endpoint: string;
  };
  sessionId?: string;
}

export type ViewTab = 'dashboard' | 'trace' | 'endpoint' | 'jsonUpload';
export type GraphLayout = 'horizontal' | 'vertical';
export type GraphMode = 'graph' | 'node-json' | 'json';
