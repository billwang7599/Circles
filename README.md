# Circles

A group planning tool. Capstone project, **work in progress**.

Project Abstract

Historical and Cultural Context
Social gatherings have long played an important role in how people build and maintain relationships. Today, much of the coordination behind these gatherings happens digitally, requiring groups to juggle half a dozen specialized applications. Currently, there exist many individual apps, used for discussions, scheduling available times, finding ideas, generating invites, and splitting costs and expenses. Each of these tools works independently, but they are all built around distinct events, and none of them remember who the group is or what they did last time.

Market Opportunity
Because information related to a single event becomes scattered across multiple disconnected applications, much of the same coordination must be repeated for each new plan. This creates a clear opportunity for a unified platform centered around recurring social circles. University students, in particular, plan activities with the same few groups almost every week, making them a natural first market for our product, Circles.

User's Motivation and Usage Modalities
Social circles organize activities to spend time together, ranging from spontaneous ideas like “dinner this weekend?” to multi-day ski trips. In Circles, users create social circles that last, such as “Roommates” or “SE Friends”, where each group collects its own plans, saved ideas, past events, and photos over time. Members can indicate availability, add their budget, input preferences, and vote on options. Once decided, the group locks the plan in as a finalized event. The event page then serves as a central hub for the itinerary, bookings, shared tasks, and eventually keeps the photos and expenses as part of the group's history.

User's Pain Point
A major challenge in planning within a social circle is turning scattered discussions and individual preferences into a cohesive plan. Deciding what to do requires weighing four things at once: who is free, what everyone can spend, what people want to do, and what the group or individuals has already done. Because these signals currently live in four different apps, no single tool can evaluate them together. Groups are forced to manually reconcile conflicting availabilities and budgets through extensive back-and-forth in chat threads, even though every member has already explicitly stated what they need elsewhere.

How Application of Advanced Technical Knowledge Solves the Problem / Results
Circles solves this by providing a unified shared model that keeps all four planning signals in one place. Members can set constraints privately, allowing someone's budget to conservatively shape the results without the rest of the group seeing it. An AI-assisted planning system uses constraint optimization to read this model directly. Given the group’s free times, votes, and spending limits, the AI generates two or three complete, feasible options and a short summary of the event. This is only possible because the signals sit in a single shared space. Over time, the model builds a historical record of what the group has liked and done, providing context to continuously improve future recommendations.

Results
The capstone will deliver a working prototype covering the core planning loop: persistent groups, plans that members join and fill in their availability against, group voting, the AI planner, finalized event lock-in, and shared expense splitting. The prototype will be actively tested with student groups on campus. The fuller event hub (itineraries, bookings, reminders), automated calendar sync, and the long-term group memory that improves recommendations over time are left as future work.

Initial Public Deployment during the Last Work Term
As Circles is a new project, there is no initial public deployment or work prior to this term.


