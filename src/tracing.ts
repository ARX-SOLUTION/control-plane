import { NodeSDK } from '@opentelemetry/sdk-node';
import { tracing } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';

const endpoint = process.env.OTLP_ENDPOINT;

const sdk = new NodeSDK({
  traceExporter: endpoint
    ? new OTLPTraceExporter({ url: endpoint })
    : new tracing.ConsoleSpanExporter(),
  instrumentations: [
    new HttpInstrumentation(),
    new PgInstrumentation(),
    new IORedisInstrumentation(),
    new RedisInstrumentation(),
    new AmqplibInstrumentation(),
  ],
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown());
