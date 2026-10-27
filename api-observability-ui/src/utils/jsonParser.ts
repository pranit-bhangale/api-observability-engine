import type { TraceRecord, Span, ActionCategory } from '../types';

export interface ParsedJsonResult {
  type: 'trace' | 'trace_list' | 'generic_node_tree';
  trace: TraceRecord;
  allTraces?: TraceRecord[];
  summary: string;
}

/**
 * Intelligent JSON Parser that detects the format of uploaded JSON:
 * 1. Single Trace Record or OpenTelemetry JSON -> loads into Traces & Node Graph
 * 2. Array of Trace Records -> imports traces
 * 3. Array of Spans -> wraps into a TraceRecord
 * 4. Arbitrary JSON -> converts into an interactive connected node hierarchy for visual exploration
 */
export function parseUploadedJson(rawJson: string): ParsedJsonResult {
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: any) {
    throw new Error(`Invalid JSON syntax: ${err.message}`);
  }

  if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
    throw new Error('Uploaded JSON root must be an object or array.');
  }

  // Case 1: Array of traces
  if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].traceId || parsed[0].spans)) {
    const validTraces = parsed.map((item, idx) => normalizeTraceRecord(item, idx + 1));
    return {
      type: 'trace_list',
      trace: validTraces[0],
      allTraces: validTraces,
      summary: `Imported ${validTraces.length} traces from array.`,
    };
  }

  // Case 2: Array of spans
  if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0].spanId || parsed[0].name)) {
    const trace = normalizeSpanArrayToTrace(parsed);
    return {
      type: 'trace',
      trace,
      summary: `Parsed span array into trace with ${trace.spanCount} spans.`,
    };
  }

  // Case 3: Single Trace Record
  if (parsed && typeof parsed === 'object' && (parsed.traceId || parsed.spans || parsed.resourceSpans)) {
    // If OpenTelemetry standard format (resourceSpans)
    if (parsed.resourceSpans) {
      const converted = convertOtelToTrace(parsed);
      return {
        type: 'trace',
        trace: converted,
        summary: `Imported OpenTelemetry trace with ${converted.spanCount} spans.`,
      };
    }
    const trace = normalizeTraceRecord(parsed, 1);
    return {
      type: 'trace',
      trace,
      summary: `Imported trace "${trace.name}" with ${trace.spanCount} spans.`,
    };
  }

  // Case 4: Arbitrary JSON -> Convert to a rich node tree trace!
  const genericTrace = convertArbitraryJsonToTrace(parsed);
  return {
    type: 'generic_node_tree',
    trace: genericTrace,
    summary: `Converted arbitrary JSON structure into a ${genericTrace.spanCount}-node execution hierarchy.`,
  };
}

/**
 * Normalizes trace records ensuring required span fields exist
 */
function normalizeTraceRecord(raw: any, fallbackIndex: number): TraceRecord {
  const traceId = raw.traceId || `imported-trc-${Date.now()}-${fallbackIndex}`;
  const name = raw.name || raw.operationName || raw.path || 'Imported Trace Operation';
  const category: ActionCategory = (raw.category as ActionCategory) || 'CONTROLLER';
  const status: 'OK' | 'ERROR' = raw.status === 'ERROR' || raw.error || (raw.errorCount && raw.errorCount > 0) ? 'ERROR' : 'OK';
  const durationMs = Number(raw.durationMs || raw.duration || 15.0);

  let spans: Span[] = [];
  if (Array.isArray(raw.spans) && raw.spans.length > 0) {
    spans = raw.spans.map((s: any, idx: number) => {
      const sDuration = Number(s.durationMs || s.duration || (durationMs / (raw.spans.length || 1)));
      const sOffset = Number(s.offsetMs ?? (idx * 5));
      const sStatus: 'OK' | 'ERROR' = s.status === 'ERROR' || s.error ? 'ERROR' : 'OK';
      const sDepth = typeof s.depth === 'number' ? s.depth : (idx === 0 ? 0 : 1);

      return {
        traceId,
        spanId: s.spanId || s.id || `span-${idx + 1}`,
        parentSpanId: s.parentSpanId !== undefined ? s.parentSpanId : (idx === 0 ? null : `span-${idx}`),
        depth: sDepth,
        category: (s.category as ActionCategory) || (idx === 0 ? 'CONTROLLER' : 'SERVICE'),
        name: s.name || s.operationName || `Span #${idx + 1}`,
        class: s.class || s.className || 'ImportedClass',
        method: s.method || s.name || 'execute',
        thread: s.thread || 'worker-exec-1',
        startTime: s.startTime || raw.startTime || new Date().toISOString(),
        durationMs: Math.max(0.1, sDuration),
        offsetMs: sOffset,
        offsetPct: Number(s.offsetPct || 0),
        widthPct: Number(s.widthPct || 100),
        status: sStatus,
        args: s.args,
        result: s.result,
        inputArgs: s.inputArgs || [],
        outputArgs: s.outputArgs || null,
        error: s.error ? (typeof s.error === 'string' ? s.error : JSON.stringify(s.error)) : null,
        errorMessage: s.errorMessage || (s.error ? String(s.error) : null),
        errorDetail: s.errorDetail || null,
      };
    });
  } else {
    // Generate root span if trace had no spans
    spans = [
      {
        traceId,
        spanId: 'root-span-01',
        parentSpanId: null,
        depth: 0,
        category,
        name,
        class: 'ImportedRoot',
        method: name,
        thread: 'worker-exec-1',
        startTime: raw.startTime || new Date().toISOString(),
        durationMs,
        offsetMs: 0,
        offsetPct: 0,
        widthPct: 100,
        status,
        inputArgs: raw.inputArgs || [],
        outputArgs: raw.outputArgs || null,
      },
    ];
  }

  return {
    traceId,
    name,
    category,
    status,
    startTime: raw.startTime || new Date().toISOString(),
    startLabel: raw.startLabel || new Date().toLocaleTimeString(),
    durationMs,
    spanCount: spans.length,
    errorCount: spans.filter((s) => s.status === 'ERROR').length,
    dropped: 0,
    inputArgs: raw.inputArgs || [],
    outputArgs: raw.outputArgs || null,
    error: raw.error ? String(raw.error) : null,
    errorMessage: raw.errorMessage || null,
    errorDetail: raw.errorDetail || null,
    spans,
  };
}

/**
 * Normalizes an array of raw Span objects into a complete TraceRecord
 */
function normalizeSpanArrayToTrace(rawSpans: any[]): TraceRecord {
  const root = rawSpans[0] || {};
  const traceId = root.traceId || `imported-spans-${Date.now()}`;
  const totalDuration = rawSpans.reduce((max, s) => Math.max(max, Number(s.durationMs || s.duration || 0)), 15.0);

  const spans: Span[] = rawSpans.map((s, idx) => ({
    traceId,
    spanId: s.spanId || s.id || `node-${idx + 1}`,
    parentSpanId: s.parentSpanId !== undefined ? s.parentSpanId : (idx === 0 ? null : `node-${idx}`),
    depth: typeof s.depth === 'number' ? s.depth : (idx === 0 ? 0 : 1),
    category: (s.category as ActionCategory) || (idx === 0 ? 'CONTROLLER' : 'SERVICE'),
    name: s.name || `operation-${idx + 1}`,
    class: s.class || s.className || 'AppService',
    method: s.method || s.name || 'execute',
    thread: s.thread || 'main-thread',
    startTime: s.startTime || new Date().toISOString(),
    durationMs: Number(s.durationMs || s.duration || 10),
    offsetMs: Number(s.offsetMs || idx * 10),
    offsetPct: Number(s.offsetPct || 0),
    widthPct: Number(s.widthPct || 10),
    status: s.status === 'ERROR' || s.error ? 'ERROR' : 'OK',
    result: s.result,
    error: s.error ? String(s.error) : null,
  }));

  return {
    traceId,
    name: root.name || 'Imported Span Pipeline',
    category: (root.category as ActionCategory) || 'CONTROLLER',
    status: spans.some((s) => s.status === 'ERROR') ? 'ERROR' : 'OK',
    startTime: new Date().toISOString(),
    startLabel: new Date().toLocaleTimeString(),
    durationMs: totalDuration,
    spanCount: spans.length,
    errorCount: spans.filter((s) => s.status === 'ERROR').length,
    dropped: 0,
    spans,
  };
}

/**
 * Converts OpenTelemetry ResourceSpans into standard TraceRecord
 */
function convertOtelToTrace(otel: any): TraceRecord {
  const traceId = `otel-${Date.now()}`;
  const spans: Span[] = [];

  try {
    const scopeSpans = otel.resourceSpans?.[0]?.scopeSpans || [];
    scopeSpans.forEach((scope: any) => {
      (scope.spans || []).forEach((s: any, idx: number) => {
        const startNanos = Number(s.startTimeUnixNano || 0);
        const endNanos = Number(s.endTimeUnixNano || 0);
        const durMs = endNanos > startNanos ? (endNanos - startNanos) / 1_000_000 : 5.0;

        spans.push({
          traceId,
          spanId: s.spanId || `otel-span-${idx}`,
          parentSpanId: s.parentSpanId || null,
          depth: s.parentSpanId ? 1 : 0,
          name: s.name || 'otel-span',
          category: s.kind === 1 ? 'CONTROLLER' : s.kind === 3 ? 'REPOSITORY' : 'SERVICE',
          class: 'OpenTelemetryTrace',
          method: s.name || 'otelSpan',
          thread: 'otel-worker',
          startTime: new Date().toISOString(),
          durationMs: Number(durMs.toFixed(2)),
          offsetMs: idx * 5,
          offsetPct: 0,
          widthPct: 100,
          status: s.status?.code === 2 ? 'ERROR' : 'OK',
          result: s.attributes,
        });
      });
    });
  } catch (err) {
    console.warn('Failed parsing OTEL spans', err);
  }

  const rootSpan = spans.find((s) => !s.parentSpanId) || spans[0] || {
    traceId,
    spanId: 'root-otel',
    parentSpanId: null,
    depth: 0,
    name: 'OpenTelemetry Ingested Trace',
    category: 'CONTROLLER' as ActionCategory,
    class: 'OpenTelemetry',
    method: 'ingest',
    thread: 'otel',
    startTime: new Date().toISOString(),
    durationMs: 25.0,
    offsetMs: 0,
    offsetPct: 0,
    widthPct: 100,
    status: 'OK' as const,
  };

  const totalDuration = spans.reduce((max, s) => Math.max(max, s.durationMs), 15);

  return {
    traceId,
    name: rootSpan.name || 'OpenTelemetry Ingested Trace',
    category: rootSpan.category,
    status: spans.some((s) => s.status === 'ERROR') ? 'ERROR' : 'OK',
    durationMs: totalDuration,
    spanCount: Math.max(spans.length, 1),
    errorCount: spans.filter((s) => s.status === 'ERROR').length,
    dropped: 0,
    startTime: new Date().toISOString(),
    startLabel: new Date().toLocaleTimeString(),
    spans: spans.length > 0 ? spans : [rootSpan],
  };
}

/**
 * Converts any arbitrary JSON object or tree into an interactive connected Node Trace
 */
function convertArbitraryJsonToTrace(data: any): TraceRecord {
  const traceId = `json-tree-${Date.now()}`;
  const spans: Span[] = [];
  let spanCounter = 0;

  function walk(obj: any, parentId: string | null, keyName: string, depth: number) {
    spanCounter++;
    const currentId = `node-${spanCounter}`;
    const isObj = obj !== null && typeof obj === 'object';
    const isArr = Array.isArray(obj);

    const category: ActionCategory = depth === 0 ? 'CONTROLLER' : isArr ? 'REPOSITORY' : isObj ? 'SERVICE' : 'AUTO';
    const valPreview = !isObj
      ? String(obj)
      : isArr
      ? `Array(${obj.length})`
      : `Object(${Object.keys(obj).length} keys)`;

    spans.push({
      traceId,
      spanId: currentId,
      parentSpanId: parentId,
      depth,
      category,
      name: `${keyName}: ${valPreview}`,
      class: isArr ? 'JSONArray' : isObj ? 'JSONObject' : typeof obj,
      method: keyName,
      thread: 'json-parser-thread',
      startTime: new Date().toISOString(),
      durationMs: Math.max(1, 25 - depth * 3),
      offsetMs: (spanCounter - 1) * 8,
      offsetPct: 0,
      widthPct: 100,
      status: 'OK',
      result: obj,
    });

    if (depth < 4) {
      if (isArr) {
        obj.slice(0, 10).forEach((item: any, idx: number) => {
          walk(item, currentId, `[${idx}]`, depth + 1);
        });
      } else if (isObj) {
        Object.entries(obj)
          .slice(0, 12)
          .forEach(([k, v]) => {
            walk(v, currentId, k, depth + 1);
          });
      }
    }
  }

  walk(data, null, 'Root JSON Payload', 0);

  return {
    traceId,
    name: 'Arbitrary JSON Node Hierarchy',
    category: 'CONTROLLER',
    status: 'OK',
    durationMs: spans.reduce((sum, s) => sum + s.durationMs, 0),
    spanCount: spans.length,
    errorCount: 0,
    dropped: 0,
    startTime: new Date().toISOString(),
    startLabel: new Date().toLocaleTimeString(),
    spans,
  };
}

/**
 * Sample JSON presets for testing parser directly in the UI
 */
export const SAMPLE_JSON_PRESETS = [
  {
    title: '12-Call Deep Architecture Trace (Root → 4 Services → 12 Method Tree)',
    desc: 'Root method makes 4 major service calls branching into repositories, clients and decoders',
    json: JSON.stringify(
      {
        traceId: 'trc-order-deep-call-7788',
        name: 'POST /api/v1/orders/checkout',
        category: 'CONTROLLER',
        status: 'OK',
        startTime: '2026-10-27T18:30:00.000Z',
        startLabel: '18:30:00',
        durationMs: 348.65,
        spanCount: 12,
        errorCount: 0,
        dropped: 0,
        spans: [
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-1',
            parentSpanId: null,
            depth: 0,
            category: 'CONTROLLER',
            name: 'OrderController.checkoutOrder',
            class: 'com.store.order.controller.OrderController',
            method: 'checkoutOrder',
            thread: 'http-nio-8080-exec-1',
            durationMs: 348.65,
            offsetMs: 0,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-2',
            parentSpanId: 'span-1',
            depth: 1,
            category: 'SERVICE',
            name: 'AuthService.validateSession',
            class: 'com.store.auth.service.AuthService',
            method: 'validateSession',
            thread: 'http-nio-8080-exec-1',
            durationMs: 38.4,
            offsetMs: 5.2,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-3',
            parentSpanId: 'span-2',
            depth: 2,
            category: 'SERVICE',
            name: 'TokenDecoder.verifyJwtSignature',
            class: 'com.store.security.jwt.TokenDecoder',
            method: 'verifyJwtSignature',
            thread: 'http-nio-8080-exec-1',
            durationMs: 14.2,
            offsetMs: 10.1,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-4',
            parentSpanId: 'span-2',
            depth: 2,
            category: 'REPOSITORY',
            name: 'UserRepository.findUserById',
            class: 'com.store.user.repository.UserRepository',
            method: 'findUserById',
            thread: 'http-nio-8080-exec-1',
            durationMs: 19.8,
            offsetMs: 26.5,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-5',
            parentSpanId: 'span-1',
            depth: 1,
            category: 'SERVICE',
            name: 'InventoryService.reserveStock',
            class: 'com.store.inventory.service.InventoryService',
            method: 'reserveStock',
            thread: 'http-nio-8080-exec-1',
            durationMs: 62.5,
            offsetMs: 48.0,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-6',
            parentSpanId: 'span-5',
            depth: 2,
            category: 'SERVICE',
            name: 'WarehouseRouting.selectFulfillmentHub',
            class: 'com.store.logistics.WarehouseRouting',
            method: 'selectFulfillmentHub',
            thread: 'http-nio-8080-exec-1',
            durationMs: 24.1,
            offsetMs: 52.3,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-7',
            parentSpanId: 'span-6',
            depth: 3,
            category: 'REPOSITORY',
            name: 'StockRepository.decrementAvailableQuantity',
            class: 'com.store.inventory.repository.StockRepository',
            method: 'decrementAvailableQuantity',
            thread: 'http-nio-8080-exec-1',
            durationMs: 31.4,
            offsetMs: 78.4,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-8',
            parentSpanId: 'span-1',
            depth: 1,
            category: 'SERVICE',
            name: 'PricingService.computeFinalTotal',
            class: 'com.store.pricing.service.PricingService',
            method: 'computeFinalTotal',
            thread: 'http-nio-8080-exec-1',
            durationMs: 55.3,
            offsetMs: 115.0,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-9',
            parentSpanId: 'span-8',
            depth: 2,
            category: 'SERVICE',
            name: 'TaxEngineClient.calculateVatRate',
            class: 'com.store.pricing.client.TaxEngineClient',
            method: 'calculateVatRate',
            thread: 'http-nio-8080-exec-1',
            durationMs: 28.5,
            offsetMs: 120.2,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-10',
            parentSpanId: 'span-8',
            depth: 2,
            category: 'SERVICE',
            name: 'DiscountRuleService.applyPromoCoupon',
            class: 'com.store.pricing.rules.DiscountRuleService',
            method: 'applyPromoCoupon',
            thread: 'http-nio-8080-exec-1',
            durationMs: 17.6,
            offsetMs: 152.0,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-11',
            parentSpanId: 'span-1',
            depth: 1,
            category: 'SERVICE',
            name: 'PaymentService.processTransaction',
            class: 'com.store.payment.service.PaymentService',
            method: 'processTransaction',
            thread: 'http-nio-8080-exec-1',
            durationMs: 165.2,
            offsetMs: 178.0,
            status: 'OK'
          },
          {
            traceId: 'trc-order-deep-call-7788',
            spanId: 'span-12',
            parentSpanId: 'span-11',
            depth: 2,
            category: 'REPOSITORY',
            name: 'BankingGatewayClient.authorizeCard',
            class: 'com.store.payment.client.BankingGatewayClient',
            method: 'authorizeCard',
            thread: 'http-nio-8080-exec-1',
            durationMs: 152.8,
            offsetMs: 185.0,
            status: 'OK'
          }
        ]
      },
      null,
      2
    )
  },
  {
    title: 'Spring Deep-Call Trace (Controller → Service → Repository)',
    desc: 'Simulated 4-tier microservice trace with database query',
    json: JSON.stringify(
      {
        traceId: 'sample-todo-create-trace',
        name: 'POST /api/todos - Create Todo Task',
        category: 'CONTROLLER',
        durationMs: 42.8,
        status: 'OK',
        spans: [
          {
            spanId: 'span-ctrl-1',
            parentSpanId: null,
            name: 'TodoController.createTodo',
            category: 'CONTROLLER',
            class: 'io.github.pranit.controller.TodoController',
            method: 'createTodo',
            durationMs: 42.8,
            offsetMs: 0,
            depth: 0,
            status: 'OK',
          },
          {
            spanId: 'span-srv-2',
            parentSpanId: 'span-ctrl-1',
            name: 'TodoService.processNewItem',
            category: 'SERVICE',
            class: 'io.github.pranit.service.TodoService',
            method: 'processNewItem',
            durationMs: 34.5,
            offsetMs: 3.2,
            depth: 1,
            status: 'OK',
          },
          {
            spanId: 'span-repo-3',
            parentSpanId: 'span-srv-2',
            name: 'TodoRepository.saveAndFlush',
            category: 'REPOSITORY',
            class: 'io.github.pranit.repository.TodoRepository',
            method: 'saveAndFlush',
            durationMs: 18.2,
            offsetMs: 10.5,
            depth: 2,
            status: 'OK',
          },
          {
            spanId: 'span-audit-4',
            parentSpanId: 'span-srv-2',
            name: 'AuditLogClient.recordActivity',
            category: 'SERVICE',
            class: 'io.github.pranit.client.AuditLogClient',
            method: 'recordActivity',
            durationMs: 4.1,
            offsetMs: 31.0,
            depth: 2,
            status: 'OK',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    title: 'Microservice Error & Fallback Trace',
    desc: 'Simulated downstream timeout and circuit-breaker execution',
    json: JSON.stringify(
      {
        traceId: 'sample-payment-failure-trace',
        name: 'POST /api/checkout - Payment Gateway Error',
        category: 'CONTROLLER',
        durationMs: 95.4,
        status: 'ERROR',
        spans: [
          {
            spanId: 'root-checkout',
            parentSpanId: null,
            name: 'CheckoutController.processPayment',
            category: 'CONTROLLER',
            class: 'com.store.controller.CheckoutController',
            method: 'processPayment',
            durationMs: 95.4,
            offsetMs: 0,
            depth: 0,
            status: 'ERROR',
            error: 'Upstream payment processor socket timeout after 75ms',
          },
          {
            spanId: 'span-gw-call',
            parentSpanId: 'root-checkout',
            name: 'StripeGatewayClient.chargeCard',
            category: 'SERVICE',
            class: 'com.store.client.StripeGatewayClient',
            method: 'chargeCard',
            durationMs: 82.0,
            offsetMs: 4.2,
            depth: 1,
            status: 'ERROR',
            error: 'java.net.SocketTimeoutException: Read timed out',
          },
          {
            spanId: 'span-fallback',
            parentSpanId: 'root-checkout',
            name: 'ResilienceFallback.queueRetry',
            category: 'REPOSITORY',
            class: 'com.store.resilience.ResilienceFallback',
            method: 'queueRetry',
            durationMs: 6.5,
            offsetMs: 87.0,
            depth: 1,
            status: 'OK',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    title: 'Arbitrary Nested JSON Structure',
    desc: 'Converts any configuration or REST response into an interactive node hierarchy',
    json: JSON.stringify(
      {
        application: 'ObservabilityDemoApp',
        environment: 'Production',
        version: '1.2.0',
        database: {
          host: 'postgres-primary.internal',
          port: 5432,
          poolSize: 20,
          ssl: true,
        },
        services: [
          { name: 'AuthService', port: 8081, status: 'HEALTHY' },
          { name: 'OrderService', port: 8082, status: 'HEALTHY' },
          { name: 'PaymentService', port: 8083, status: 'DEGRADED' },
        ],
      },
      null,
      2
    ),
  },
];
