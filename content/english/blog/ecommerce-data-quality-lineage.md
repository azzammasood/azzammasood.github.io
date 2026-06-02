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

### What the Problem was

I built this to tackle a problem every data team hits: **bad data reaches dashboards**, and nobody knows **where it broke** or **how to fix it**.

In an e-commerce pipeline, that can mean revenue dashboards drift, product metrics look inconsistent, and the team has to manually trace raw tables, transformations, and downstream models just to understand what changed.

### How I solved it

This pipeline covers the full journey of e-commerce data: from raw orders landing in **S3**, through transformation and quality checks with **dbt**, to a **Marquez** catalog that tracks lineage automatically.

The goal was to make the pipeline observable from ingestion to analytics, with automated tests catching data issues before they reach dashboards.

### Architecture

![Architecture diagram](/images/projects/ecommerce-data-quality-lineage/architecture.png)

* **AWS S3** - landing zone for raw data (simulated in the demo; Terraform provisions the bucket).
* **Apache Airflow** - schedules the DAG and coordinates every step.
* **PostgreSQL** - warehouse layers: raw, staging, and analytics.
* **dbt** - SQL transformations plus **24 data quality tests** on every run.
* **OpenLineage + Marquez** - captures lineage for each model without manual docs.
* **Terraform** - provisions S3 on AWS.

### Workflow

1. **Load raw** - orders, users, products, and line items into the raw schema.
2. **Stage** - dbt builds four staging views with clean names, types, and conventions.
3. **Marts** - dbt builds `dim_users`, `dim_products`, and `fct_orders` for analytics.
4. **Tests** - 24 automated checks run before the data is trusted by dashboards.
5. **Lineage capture** - OpenLineage emits run metadata into Marquez.

### Data quality examples

| Check | What it catches |
| ----- | ---------------- |
| `unique` | Duplicate IDs |
| `not_null` | Missing required fields |
| `relationships` | Orphan foreign keys |
| `accepted_values` | Bad statuses, such as typos |
| Custom email test | Invalid user emails |

### Lineage in Marquez

After each run you can open Marquez, pick the Postgres namespace, and open **`fct_orders`** to see the full graph back to raw sources. That makes "revenue looks wrong" investigations fast.

### Run it locally

You need **Docker** and **Docker Compose**.

```bash
git clone https://github.com/azzammasood/ecommerce-data-quality-lineage-platform.git
cd ecommerce-data-quality-lineage-platform
docker compose up -d
```

Then open **Airflow** at `http://localhost:8080` (admin / admin) and **Marquez** at `http://localhost:3000`. Turn on the DAG `ecommerce_data_quality_and_lineage` and trigger a run.

### Screenshots

<img src="/images/projects/ecommerce-data-quality-lineage/airflow%20dag%20success.png" alt="Airflow DAG completed successfully" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="675" />

<img src="/images/projects/ecommerce-data-quality-lineage/dbt%20test%20results.png" alt="dbt test results" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="675" />

<img src="/images/projects/ecommerce-data-quality-lineage/marquez%20ui.png" alt="Marquez lineage UI" class="my-6 w-full max-w-4xl rounded-lg border border-border shadow-sm dark:border-darkmode-border" loading="lazy" width="1200" height="675" />

If this project helped you, consider giving it a star on [GitHub](https://github.com/azzammasood/ecommerce-data-quality-lineage-platform).

### Adding or changing images for this project

1. Put files under **`static/images/projects/ecommerce-data-quality-lineage/`**.
2. Prefer filenames without spaces, such as `airflow-dag-success.png`, so Markdown stays simple.
3. If a filename has spaces, use encoded paths in HTML, such as `airflow%20dag%20success.png`, or rename the file to use hyphens.
