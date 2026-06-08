---
title: "AWS CRM APIs"
meta_title: "AWS CRM APIs"
description: "AWS CRM data pipeline with DynamoDB ingestion, S3 landing, PySpark anomaly detection on EMR, and Redshift analytics."
date: 2026-06-08T05:00:00Z
image: "/images/image-placeholder.png"
categories: ["AWS", "Data Engineering", "Analytics"]
author: "Ahmad Uzzam Masood"
tags: ["DynamoDB", "S3", "EMR", "PySpark", "Redshift", "Terraform", "KMS"]
draft: false
---

An AWS batch data pipeline for CRM records that separates operational traffic from analytics workloads.

The project extracts transactional CRM data from **Amazon DynamoDB**, lands raw records in **Amazon S3**, cleans anomalies with **PySpark on Amazon EMR**, and loads curated Parquet-backed data into **Amazon Redshift** for analytical queries.

### Architecture

* **DynamoDB** stores operational CRM records.
* **S3** acts as the raw and staging data lake.
* **Amazon EMR** runs distributed PySpark processing.
* **MLlib K-Means** flags negative billing outliers and anomalous records.
* **Redshift** serves cleaned data for analytics.
* **Terraform** provisions the AWS infrastructure.
* **AWS KMS** encrypts DynamoDB, S3, and Redshift resources with a customer-managed key.

### Key outcomes

* Isolated analytics workloads from live CRM API traffic.
* Removed unreliable records before they reached reporting tables.
* Stored clean datasets in compressed Parquet format.
* Kept infrastructure reproducible and version-controlled with Terraform.

Source code: [github.com/azzammasood/aws-crm-apis](https://github.com/azzammasood/aws-crm-apis).
