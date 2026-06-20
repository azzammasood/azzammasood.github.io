---
title: "AWS Predictive Site Outage Lakehouse"
meta_title: "AWS Predictive Site Outage Lakehouse"
description: "Serverless AWS lakehouse for telecom telemetry with anomaly detection, Iceberg tables, proactive Slack alerts, and executive risk dashboards."
date: 2025-06-01T05:00:00Z
image: "/images/projects/aws-predictive-site-outage/architecture.png"
categories: ["AWS", "Streaming", "Machine Learning"]
author: "Ahmad Uzzam Masood"
tags: ["AWS Glue", "Kinesis", "Apache Iceberg", "Redshift", "QuickSight", "SNS", "Lambda", "Isolation Forest"]
draft: false
---
### What the problem was

Telecom operators usually discover outages after a tower has already degraded enough to fall offline. That means reactive maintenance, emergency dispatches, revenue loss, and a poor customer experience in the affected area.

I wanted to model a more mature operating pattern: ingest physical telemetry from telecom hardware in near real time, detect anomalous multivariate behavior before failure, and surface a practical risk view for both engineering and leadership.

### How I solved it

I designed a **serverless AWS medallion lakehouse** that ingests site telemetry from edge gateways into **Kinesis**, lands raw events in **S3**, processes and scores them in **AWS Glue**, stores curated layers in **Apache Iceberg**, and exposes executive-ready reporting through **Redshift Serverless** and **QuickSight**.

The anomaly-detection path uses an **Isolation Forest** model applied inside distributed PySpark jobs, while the incident path uses **CloudWatch**, **SNS**, and **Lambda** to push proactive Slack alerts when site behavior becomes risky.

### Architecture

![Architecture diagram](/images/projects/aws-predictive-site-outage/architecture.png)

* **Edge hardware** - rectifiers, PLCs, and HVAC systems at telecom sites produce voltage, current, and temperature telemetry.
* **Industrial gateway** - polls Modbus TCP / RTU registers, buffers locally during link loss, and publishes encrypted JSON payloads upstream.
* **Amazon Kinesis Data Streams** - absorbs bursty telemetry and reconnect spikes from offline sites.
* **Amazon Kinesis Data Firehose** - micro-batches raw JSON to S3 to avoid the small-file problem.
* **AWS Glue (PySpark)** - enforces schema, applies data-quality handling, and runs anomaly scoring.
* **Apache Iceberg on S3** - provides ACID-style `MERGE` behavior for deduplication and change-safe writes.
* **AWS Step Functions + EventBridge** - orchestrates the batch sequence every 15 minutes.
* **Amazon CloudWatch + SNS + Lambda** - turns elevated anomaly counts into operational Slack alerts.
* **Amazon Redshift Serverless + QuickSight** - powers a zero-ETL executive risk dashboard on top of Gold tables.

### Workflow

1. **Edge ingestion** - site gateways poll hardware every few seconds, buffer locally when the backhaul drops, and publish flat JSON events into Kinesis.
2. **Bronze landing** - Firehose buffers records into 60-second / 5 MB micro-batches and writes partitioned raw JSON into S3.
3. **Silver enrichment** - Glue reads the latest Bronze partitions, enforces schema types, handles bad records, and scores each record with an Isolation Forest model.
4. **CDC-safe storage** - Glue writes results into Silver Iceberg tables using `MERGE INTO` so duplicate or late telemetry does not corrupt the dataset.
5. **Gold aggregation** - a downstream Glue job builds fact and dimension tables for reporting, including daily site metrics and risk views.
6. **Alerting** - CloudWatch thresholds on anomaly counts trigger SNS, which invokes Lambda to deliver rich Slack alerts with context.
7. **Serving** - Redshift Spectrum mounts the Gold Iceberg tables directly from S3, and QuickSight visualizes site risk, power draw, and thermal trends.

### Why these design choices

| Decision | Why it mattered |
| ----- | ----- |
| **Firehose + Glue micro-batching** | Lower cost than running a 24/7 streaming cluster while still meeting a sub-20-minute alerting goal. |
| **Apache Iceberg** | Enables deduplication and CDC-style `MERGE` writes directly on the lake without rewriting entire S3 partitions. |
| **Isolation Forest in a Pandas UDF** | Lets Python ML models run in parallel across Spark workers while preserving distributed execution. |
| **Step Functions orchestration** | Guarantees ordered Bronze -> Silver -> Gold execution instead of depending on loose cron timing. |
| **Redshift Spectrum over copied warehouse loads** | Preserves a zero-ETL serving pattern and avoids extra data movement into a separate BI store. |
| **SNS + Lambda alert fanout** | Keeps the ETL layer decoupled from the final incident delivery channel. |

### Production-minded details

This project also accounts for real-world edge and lakehouse concerns:

* **Offline buffering** at the gateway prevents data loss during network drops.
* **Burst tolerance** in Kinesis helps absorb reconnect storms when many buffered sites come back online.
* **Late and duplicate event handling** is managed with Iceberg upserts instead of brittle append-only logic.
* **Dead-letter handling** is part of the design so malformed records do not crash the pipeline.
* **Historical correctness** can be preserved through dimension modeling patterns such as site-capacity history.

### Repository structure

```text
.
├── docs/                 # Architecture and service diagrams
├── glue_jobs/            # PySpark ETL jobs
├── lambda_functions/     # Slack alerting handlers
├── producer/             # Telemetry simulators
├── terraform/            # Infrastructure as Code
├── .github/workflows/    # CI/CD pipelines
├── Makefile              # Automation commands
└── README.md
```

### Deployment flow

```bash
git clone https://github.com/azzammasood/aws-predictive-site-outage.git
cd aws-predictive-site-outage
make deploy
```

You need an **AWS account**, **Terraform 1.4+**, **Python 3.9+**, and a **Slack webhook** for alert delivery.

### Screenshots

<img src="/images/projects/aws-predictive-site-outage/flowchart.png" alt="Predictive outage pipeline flowchart" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="900" />

<img src="/images/projects/aws-predictive-site-outage/s3.png" alt="S3 raw landing layer diagram" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="720" />

<img src="/images/projects/aws-predictive-site-outage/step-function.png" alt="Step Functions orchestration diagram" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="720" />

<img src="/images/projects/aws-predictive-site-outage/slack-alerts.png" alt="Slack alert example for predictive outage monitoring" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="720" />

<img src="/images/projects/aws-predictive-site-outage/redshift.png" alt="Redshift serving layer diagram" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="720" />

If this project helped you, consider giving it a star on [GitHub](https://github.com/azzammasood/aws-predictive-site-outage).
