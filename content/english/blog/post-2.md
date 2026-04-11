---
title: "Deep Dive into Service Analytics"
meta_title: ""
description: "Designed a real-time analytics platform with strong observability."
date: 2025-07-15T05:00:00Z
image: "/images/image-placeholder.png"
categories: ["Streaming", "Observability"]
author: "Ahmad Uzzam Masood"
tags: ["Dataflow", "Pub/Sub", "BigQuery", "Cloud Run", "dbt"]
draft: false
---
I built this platform to turn raw service logs into operational insight in near real-time.

The pipeline used Dataflow to process streaming messages from Pub/Sub, then loaded clean data into BigQuery for analysis. I modeled marts in dbt and deployed a Cloud Run microservice to expose live health metrics.

## Key outcomes

- Faster feedback loop for service performance issues
- Better incident response through metric-driven observability
- Clear ownership with structured Cloud Logging across the pipeline
- Cleaner analytical models for business and operations teams
