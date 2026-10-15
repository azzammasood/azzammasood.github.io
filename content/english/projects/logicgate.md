---
title: "LogicGate"
meta_title: "LogicGate: a home for business logic"
description: "One source of truth for metric definitions: stakeholders define rules visually, every change is versioned and approved, and each definition compiles to SQL, Python, or dbt."
date: 2026-10-14T10:00:00Z
weight: 1
animation: "logicgate"
website: "https://logicgate.space"
loom: "https://www.loom.com/share/c6bc4fa4ae5a409fad0a14015eefeb62"
categories: ["Data Governance", "Semantic Layer", "Product"]
author: "Ahmad Uzzam Masood"
tags: ["Next.js", "TypeScript", "Supabase", "Prisma", "SQL", "dbt"]
draft: false
---

### What the problem was

Dashboards disagree. Not because the data is wrong, but because the definitions are.

In my experience working with data teams, "active customer" or "MRR" often lives in old SQL queries, dashboards, and Slack or WhatsApp threads. Change a filter and nobody knows who did it or why. Business stakeholders can't read the logic, so they just have to trust it.

Day to day, that looked like this:

* Every stakeholder had their own version of the logic.
* Nothing was documented anywhere.
* Definitions changed daily, verbally or in chat.
* Nobody knew which version was "current", or who approved it.
* So the same metric came out different in every dashboard.

The engineers in the middle were left guessing, rewriting SQL every time the "rules" moved. The problem was never the data. It was that the business logic had no home.

### How I solved it

**LogicGate** is that home:

* **Visual definitions:** stakeholders define metrics and rules visually, with no code.
* **Versioned changes:** every change is versioned, with a reason, an author, and a diff.
* **Approvals:** critical changes need an approver before going live.
* **Discussion in context:** conversations happen on the definition, not in a chat thread that disappears.
* **Compiles to code:** each definition compiles automatically to SQL, Python, or dbt.
* **One source of truth** that business and engineering can both read.

### Walkthrough

<div class="project-video">
  <iframe src="https://www.loom.com/embed/c6bc4fa4ae5a409fad0a14015eefeb62" title="LogicGate walkthrough" loading="lazy" allowfullscreen></iframe>
</div>

Try it at [logicgate.space](https://logicgate.space), or watch the [3-minute walkthrough on Loom](https://www.loom.com/share/c6bc4fa4ae5a409fad0a14015eefeb62).

### Stack

Built with **Next.js**, **TypeScript**, **Supabase**, and **Prisma**.
