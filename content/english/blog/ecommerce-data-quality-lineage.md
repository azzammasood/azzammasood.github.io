---
title: "E-Commerce Data Quality & Lineage Platform"
meta_title: "E-Commerce Data Quality & Lineage"
description: "End-to-end pipeline: S3 landing, Airflow orchestration, dbt transformations, 24 data quality tests, and OpenLineage in Marquez."
date: 2026-04-11T10:00:00Z
image: "/images/projects/ecommerce-data-quality-lineage/architecture.png"
categories: ["Data Quality", "Lineage", "AWS"]
author: "Ahmad Uzzam Masood"
tags: ["Airflow", "dbt", "OpenLineage", "Marquez", "PostgreSQL", "Terraform", "S3"]
draft: false
---

![Architecture diagram](/images/projects/ecommerce-data-quality-lineage/architecture.png)

If this project helped you, consider giving it a star on [GitHub](https://github.com/azzammasood/ecommerce-data-quality-lineage-platform).

I built this to tackle a problem every data team hits: **bad data reaches dashboards**, and nobody knows **where it broke** or **how to fix it**.

This pipeline covers the full journey of e-commerce data: from raw orders landing in **S3**, through transformation and quality checks with **dbt**, to a **Marquez** catalog that tracks lineage automatically.

### Screenshots

<img src="/images/projects/ecommerce-data-quality-lineage/airflow%20dag%20success.png" alt="Airflow DAG completed successfully" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="675" />

<img src="/images/projects/ecommerce-data-quality-lineage/dbt%20test%20results.png" alt="dbt test results" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="675" />

<img src="/images/projects/ecommerce-data-quality-lineage/marquez%20ui.png" alt="Marquez lineage UI" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="675" />

### Architecture (left to right)

* **AWS S3** — landing zone for raw data (simulated in the demo; Terraform provisions the bucket).
* **Apache Airflow** — schedules the DAG and coordinates every step.
* **PostgreSQL** — warehouse layers: raw → staging → analytics.
* **dbt** — SQL transformations plus **24 data quality tests** on every run.
* **OpenLineage + Marquez** — captures lineage for each model without manual docs.
* **Terraform** — provisions S3 on AWS.

### What the DAG does

1. **Load raw** — orders, users, products, and line items into the raw schema (mirrors an S3-driven load).
2. **Stage** — dbt builds four staging views (clean names, types, conventions).
3. **Marts** — `dim_users`, `dim_products`, and `fct_orders` (revenue and item counts).
4. **Tests** — 24 automated checks; failures stop the pipeline before analytics.

### Data quality examples

| Check | What it catches |
| ----- | ---------------- |
| `unique` | Duplicate IDs |
| `not_null` | Missing required fields |
| `relationships` | Orphan foreign keys |
| `accepted_values` | Bad statuses (e.g. typos) |
| Custom email test | Invalid user emails |

### Lineage in Marquez

After each run you can open Marquez, pick the Postgres namespace, and open **`fct_orders`** to see the full graph back to raw sources. That makes “revenue looks wrong” investigations fast.

### Run it locally

You need **Docker** and **Docker Compose**.

```bash
git clone https://github.com/azzammasood/ecommerce-data-quality-lineage-platform.git
cd ecommerce-data-quality-lineage-platform
docker compose up -d
```

Then: **Airflow** at `http://localhost:8080` (admin / admin), **Marquez** at `http://localhost:3000`. Turn on the DAG `ecommerce_data_quality_and_lineage` and trigger a run.

### Adding or changing images for this project

1. Put files under **`static/images/projects/ecommerce-data-quality-lineage/`** (same folder as now).
2. Prefer **no spaces** in filenames (e.g. `airflow-dag-success.png`) so Markdown stays simple: `![Airflow](/images/projects/ecommerce-data-quality-lineage/airflow-dag-success.png)`.
3. If you keep spaces, use **encoded** paths in HTML: `airflow%20dag%20success.png`, or rename the files to use hyphens.
