---
title: "Global Flight Intelligence Pipeline"
meta_title: "Global Flight Intelligence Pipeline"
description: "Real-time flight vectors from OpenSky: Go producers/consumers, Kafka (KRaft), ClickHouse, and Grafana geomaps."
date: 2026-04-10T10:00:00Z
image: "/images/projects/flight-intelligence-pipeline/grafana-dashboard.png"
categories: ["Streaming", "Go", "Kafka"]
author: "Ahmad Uzzam Masood"
tags: ["Kafka", "ClickHouse", "Grafana", "Go", "OpenSky"]
draft: false
---

![Grafana dashboard — flight intelligence](/images/projects/flight-intelligence-pipeline/grafana-dashboard.png)

A real-time, end-to-end pipeline that **captures**, **processes**, and **visualizes** global flight movements. It highlights modern streaming architecture, distributed processing, and fast analytical storage.

### Architecture

* **Source:** live flight vectors from the **OpenSky Network** API.
* **Producer (Go):** polls the API and publishes raw events to **Kafka**.
* **Kafka (KRaft):** high-throughput messaging between ingestion and storage.
* **Consumer (Go):** reads from Kafka and bulk-loads into **ClickHouse**.
* **ClickHouse:** columnar store with MergeTree-style tables tuned for time series.
* **Grafana:** native ClickHouse plugin for live geomaps, time series, and gauges.

### Features

* Live **geomaps** of position, altitude, and speed.
* **Schema** tuned for fast ingestion at scale.
* **Grafana as code** — data sources and dashboards provisioned from repo (minimal manual UI setup).
* **Go concurrency** — goroutines, context, and graceful shutdown.

### Run it

**Prerequisites:** Docker & Compose, **Go 1.20+**.

```bash
docker compose up -d
go run cmd/producer/main.go
go run cmd/consumer/main.go
```

Open **Grafana** at `http://localhost:3000` (default `admin` / `admin`). Go to **Dashboards → Flight Intel Command Center**.

Source code: [github.com/azzammasood](https://github.com/azzammasood).

### How to add another project with images

1. Create a folder: **`static/images/projects/your-project-name/`**.
2. Add PNG or WebP files (avoid spaces in names).
3. Create a new file under **`content/english/blog/your-post.md`** with front matter including `image: "/images/projects/your-project-name/hero.png"` for the card thumbnail.
4. In the Markdown body, reference images with root URLs:

```markdown
![Dashboard](/images/projects/your-project-name/dashboard.png)
```

5. Run `npm run dev` and open **Projects** — posts are ordered by `date` in the front matter (newest first).
