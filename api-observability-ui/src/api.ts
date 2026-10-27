import type { ObservedEndpoint, SessionInfo, TraceRecord } from './types';

function getBasePath(): string {
  const path = window.location.pathname;
  if (path.includes('/obs')) {
    const idx = path.indexOf('/obs');
    return path.substring(0, idx + 4);
  }
  return '/obs';
}

export const BASE_PATH = getBasePath();

export async function fetchSession(): Promise<SessionInfo> {
  try {
    const res = await fetch(`${BASE_PATH}/auth/session`, { credentials: 'include' });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // ignore
  }
  return {
    authenticated: false,
    title: 'API Observability',
    username: '',
    role: 'ADMIN',
    observe: { endpoint: BASE_PATH }
  };
}

export async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);

    const res = await fetch(`${BASE_PATH}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      credentials: 'include',
    });

    if (res.ok || res.status === 204) {
      return { success: true };
    }

    let errorMsg = 'Invalid username or password';
    try {
      const data = await res.json();
      if (data && data.error) errorMsg = data.error;
    } catch {
      // ignore
    }
    return { success: false, error: errorMsg };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Connection failed: ${msg}` };
  }
}

export async function logout(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_PATH}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export async function fetchTraces(): Promise<TraceRecord[]> {
  try {
    const res = await fetch(`${BASE_PATH}/api/traces`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch {
    // network or backend offline
  }
  return [];
}

export async function fetchTrace(traceId: string): Promise<TraceRecord | null> {
  try {
    const res = await fetch(`${BASE_PATH}/api/traces/${traceId}`, { credentials: 'include' });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // network or backend offline
  }
  return null;
}

export async function clearTraces(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_PATH}/api/traces`, {
      method: 'DELETE',
      credentials: 'include'
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchEndpoints(): Promise<ObservedEndpoint[]> {
  try {
    const res = await fetch(`${BASE_PATH}/api/endpoints`, { credentials: 'include' });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        return list;
      }
    }
  } catch {
    // network or backend offline
  }
  return [];
}

export interface EndpointExecutionResult {
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: unknown;
  isError: boolean;
}

export async function executeEndpointRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string
): Promise<EndpointExecutionResult> {
  const start = performance.now();
  try {
    const options: RequestInit = {
      method: method.toUpperCase(),
      headers: { ...headers },
      credentials: 'include'
    };

    if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
      options.body = body;
    }

    const res = await fetch(url, options);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    let resBody: unknown;
    const text = await res.text();
    const sizeBytes = new Blob([text]).size;

    try {
      resBody = JSON.parse(text);
    } catch {
      resBody = text;
    }

    return {
      status: res.status,
      statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
      durationMs,
      sizeBytes,
      headers: resHeaders,
      body: resBody,
      isError: !res.ok
    };
  } catch (err: unknown) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 0,
      statusText: 'Network / Connection Error',
      durationMs,
      sizeBytes: 0,
      headers: {},
      body: { error: 'Failed to execute request', details: msg },
      isError: true
    };
  }
}
