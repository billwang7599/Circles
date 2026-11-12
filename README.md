# Circles

An AI-native app for planning full-day to multi-day group plans: ski trips, weekend getaways, day trips. Capstone project, **work in progress**.

## The Problem

Friends plan in group chats. Someone floats a trip, dates go back and forth, budgets go unsaid, and the plan stalls because nobody can hold everyone's constraints in their head at once.

## The Idea

Only the organizer needs the app. They describe the plan in plain language ("Ski trip with Ben and Chloe, somewhere we can drive to"), pick a rough date range, and Circles AI sets up the event page with the questions that fit that event: dates, budget, resort options, anything else. The organizer edits the questions and copies one invite link into the group chat.

Invitees tap the link and answer in about a minute, with no app and no account: whether they're in, the dates they're free, a budget range, their picks. Budgets stay private; only a group range is ever used.

As answers come in, Circles turns them into itinerary options for the group. Free dates and party size are applied in code before the model sees anything; the group's budget is applied in code afterwards, against the model's rough cost estimate, and never reaches the prompt. The AI only writes and ranks options, and the organizer still chooses.

**First market:** university students, who plan with the same few groups every term.

## Scope

**Capstone prototype**

- Describe an event and pick dates in plain language
- AI-chosen, editable questions
- Invite link with a rich preview in Messages
- Answering from the web, no account
- Itinerary options from the group's answers
- Install prompt and account claim for invitees

**Future work**

- Calendar export and sharing an itinerary as a file
- Expense splitting after the trip

## Repo Layout

| Folder    | Purpose                                                       |
| --------- | ------------------------------------------------------------- |
| `mobile/` | Expo app for organizers                                       |
| `api/`    | Hono API on Postgres: events, the invite page, the AI planner |
| `shared/` | Schemas and time helpers used by the app and the API          |

Setup and workflow: [DEVELOPMENT.md](DEVELOPMENT.md).

## Status

New project with no prior public deployment.
