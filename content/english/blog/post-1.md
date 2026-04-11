---
title: "Customer Churn Analysis Lakehouse"
meta_title: ""
description: "Built a governed Lakehouse architecture for Customer 360 analytics."
date: 2025-08-01T05:00:00Z
image: "/images/image-placeholder.png"
categories: ["Lakehouse", "Analytics"]
author: "Ahmad Uzzam Masood"
tags: ["Apache Iceberg", "BigLake", "Spark", "Cloud Composer"]
draft: false
---
This project solved a common problem: customer data lived in too many places and teams could not trust a single view.

I designed a Lakehouse on Cloud Storage with Apache Iceberg tables and BigQuery BigLake governance. Then I used Serverless for Apache Spark, orchestrated with Cloud Composer, to build customer features directly on the lake.

## Key outcomes

- Created a Customer 360 layer without duplicating large datasets
- Preserved ACID guarantees on open table formats
- Improved analyst access while keeping governance centralized
- Reduced cost compared to legacy warehouse-only workflows
