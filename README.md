# Circles

A group planning tool built around **persistent social circles**. Capstone project, **work in progress**.

## The Problem

Planning with friends means juggling separate apps for chat, scheduling, ideas, invites, and expenses. Each app is built around a single event, so none of them remember who the group is or what it did last time.

Deciding what to do means weighing four things at once:

- **Who is free**
- **What everyone can spend**
- **What people want to do**
- **What the group has already done**

These signals live in four different apps, so groups reconcile them by hand in chat threads.

## The Idea

Users create lasting circles (e.g. "Roommates", "SE Friends") that keep their own plans, saved ideas, past events, and photos over time. Members:

1. Mark their availability
2. Add their budget (kept private, but it still shapes the results)
3. Set preferences
4. Vote on options

The group then locks the winning plan in as an event. The event page is the hub for the itinerary, bookings, shared tasks, and eventually photos and expenses.

**First market:** university students, who plan with the same few groups almost every week.

## AI Planner

The AI reads the group's shared data (free times, votes, spending limits, history) and proposes two or three feasible options, each with a short summary. The group still votes and confirms. The AI never decides alone.

## Scope

**Capstone prototype**

- Persistent groups
- Plans with availability input
- Group voting
- AI planner
- Event lock-in
- Shared expense splitting

The prototype will be tested with student groups on campus.

**Future work**

- Full event hub (itineraries, bookings, reminders)
- Calendar sync
- Long-term group memory that improves recommendations

## Repo Layout

| Folder | Purpose |
| ------ | ------- |
| `ai/`  | AI planner pipeline |
| `api/` | Backend servers |
| `web/` | Web interface |

## Status

New project with no prior public deployment.
