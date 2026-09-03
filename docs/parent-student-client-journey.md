# Parent, Student, and Tutor Client Journey: Holistic Operating Model

This document captures the full client experience as it is intended by the Response Integrity operating model, as described in the public-facing operating pages, the tutor intake pages, and the implemented parent and student portal flows.

The goal is to describe the journey not as isolated screens, but as a complete service experience: what the family sees, what the student sees, how the tutor enters the system, what the operating rhythm looks like over the year, and how the business model shapes the service experience.

---

## 1. The core promise of the experience

Response Integrity is presented as a calm, structured academic performance-conditioning service rather than a casual homework-help or rescue-tutoring business.

The intended emotional experience is:

- calm rather than frantic
- structured rather than improvisational
- evidence-led rather than personality-led
- deliberate rather than reactive
- serious but supportive

The public story is simple: the learner is trained to stay clear, stable, and operational when work becomes difficult.

That promise shapes both the parent and student experience.

---

## 2. The business model behind the experience

The current family offer is a monthly subscription model with 8, 12, or 16 sessions per month, selected according to the student's diagnosed need and planned frequency.

The live pricing language in the system is:

- 8-session monthly package: R1,600
- 12-session monthly package: R2,400
- 16-session monthly package: R3,200
- Specialist allocation: R130 per qualifying evidence-backed session
- Response Integrity allocation: R70 per qualifying evidence-backed session
- payout remains package-led, not ad-hoc per session

The experience is therefore not just “buy tutoring.” It is a recurring service relationship built around:

- a monthly commitment
- a fixed weekly rhythm
- diagnostic clarity before training
- progress reporting and accountability
- an operating system, not only a lesson slot

This is important because the parent and student experience is designed to feel like an ongoing training relationship, not a one-off support session.

---

## 3. The broader operating rhythm: yearly intakes and delivery windows

The client journey does not begin with a single lesson. It begins with the company’s operating rhythm.

Response Integrity is designed as a disciplined annual system, not an ad hoc tutoring marketplace. Families enter through two annual intake windows:

- Full-Year Conditioning Intake
  - Enrollment window: 1 November - 31 January
  - Planning season: 1 November - 31 January
  - Conditioning season: 1 February - 31 August
  - Execution season: 1 September - 30 November

- Mid-Year Conditioning Intake
  - Enrollment window: 1 May - 31 May
  - Planning season: 1 May - 31 May
  - Accelerated conditioning season: 1 June - 31 August
  - Execution season: 1 September - 30 November

The operating model is intentionally structured around runway, cadence, and preparation before pressure. That means the experience is designed to feel like a planned conditioning relationship rather than a reactive rescue offering.

Across both intake paths, the standard is consistent:

- a planned 8, 12, or 16 session monthly package
- frequency matched to the student's diagnosed need
- OS-driven topic conditioning
- no panic culture
- protection of rhythm even when school pressure rises

This yearly rhythm matters because it shapes the parent and student experience before they ever reach the portal. The family is joining a system with a calendar, a standard, and a delivery model that is meant to be stable over time.

## 4. The tutor journey: how the family experience becomes possible

The tutor journey is not separate from the client journey. It is the operational foundation that makes the family experience real.

Before a family receives a tutor-led plan, the tutor has already gone through a structured entry path.

### 4.1 Tutor intake path

Tutor entry happens through two certification cycles tied to the student intake rhythm:

- Annual Tutor Certification Cycle
  - Application window: 1 October - 31 October
  - Conditioning window: 1 November - 15 January
  - Deployment begins: 1 February

- Mid-Year Tutor Certification Cycle
  - Application window: 1 April - 30 April
  - Conditioning window: 1 May - 20 May
  - Deployment begins: 1 June

This matters because the tutor experience is also time-bound and structured. The family experience is therefore not only about intake and sessions; it is also about whether the service has a trained and certified tutor layer behind it.

### 4.2 Tutor progression stages

The tutor journey is staged through a progression logic:

- Applicant Mode
  - the tutor applies and is screened for fit, readiness, and operating alignment

- Training Mode
  - the tutor learns the Response Integrity OS and proves they can work inside structure rather than improvise loosely

- Sandbox Mode
  - the tutor operates in a protected practice lane while execution is checked under pressure

- Certified Live
  - the tutor becomes deployable into the live student pool with real responsibility

There is also an explicit idea of reset or watchlist if execution drifts. The system protects trust through evidence. That means families are not simply receiving a tutor because one is available; they are receiving someone who has passed through a guarded certification path.

### 4.3 Why this matters to the family experience

The parent and student experience feels more trustworthy when the tutor experience is itself disciplined. Families are not entering a casual tutoring marketplace. They are entering a system where:

- tutors are screened and conditioned
- trust is earned through evidence
- the service is protected from loose delivery and personality-led tutoring
- the same operating standard applies across the whole service

In that sense, the tutor journey is the invisible backbone of the client experience.

## 5. How the platform behaves in code: the real implementation walkthrough

The most useful way to understand this experience is to see it as a state-driven platform rather than a set of separate pages. The current implementation is built around a few concrete state machines that determine what the parent and student see at each moment.

### 5.1 The parent gateway is really an onboarding state machine

The parent experience begins in the gateway screen, not in a simple signup form. In the implementation, the gateway component loads the parent’s enrollment status from the server and then decides which UI branch to show.

The gateway is built around these status values:

- not_enrolled
- awaiting_assignment
- awaiting_tutor_acceptance
- assigned
- proposal_sent
- session_booked
- report_received
- confirmed

It also uses a local UI step state with values such as:

- loading
- enrollment
- submitted
- awaiting_tutor_acceptance

This means the parent is not simply “entering the app.” They are moving through a tracked process where the UI changes based on backend state. The journey bar at the top is not decorative; it reflects the application lifecycle.

### 5.2 The application form collects diagnostic data, not just contact details

When the parent opens the enrollment form, the UI is structured like an intake interview rather than a generic signup. The code collects:

- parent name, phone, email, city
- student name, grade, gender, school
- stuck areas such as word problems, tests, timed work, new topics, careless errors
- a list of specific math topics the parent enters one by one
- topic-by-topic response symptom selections for the math topics that were added
- prior tutoring history
- internet access and device readiness
- process alignment and agreement fields

A particularly important implementation detail is that the form does not treat every phrase the parent enters as a math topic. The code filters out context labels such as “word problems,” “tests,” “timed work,” “new topics,” and “careless errors” so they are treated as response-context clues rather than curriculum topics.

Once the parent submits, the code packages the information into a payload that includes:

- reported topics
- response symptoms
- the rest of the intake form data

Then it polls the backend repeatedly until the parent’s status changes from “not_enrolled” to something else. This makes the application feel like a real review process rather than a single-step submit.

### 5.3 The intro session is a real booking workflow with multiple states

After assignment, the parent reaches the intro-session stage. The implementation does not treat this as a simple calendar booking. Instead, the platform uses a separate intro-session confirmation object with statuses such as:

- not_scheduled
- pending_tutor_confirmation
- pending_parent_confirmation
- confirmed
- ready
- live
- completed

The parent can propose a date and time using a modal dialog. When they submit, the code posts to the parent intro-session propose endpoint, stores the proposed time in the local query cache, and immediately refetches the intro-session confirmation. This gives the parent near-instant feedback and makes the system feel actively responsive.

If the tutor proposes a different time, the UI switches to a parent-confirmation state and shows a button that lets the parent confirm the tutor’s proposed schedule. This is a real workflow with back-and-forth decision points, not just a one-way booking action.

### 5.4 Proposal acceptance is tied directly to payment and access unlock

The proposal view is one of the most important pieces of the platform because it is where the parent transitions from intake to service commitment. The code does this in two steps:

1. The parent sees the proposal and can accept or decline it.
2. If they accept, the platform calls the proposal accept endpoint.

That endpoint can produce different outcomes:

- a paid premium confirmation
- a free-access pilot confirmation
- a PayFast redirect flow for premium payment

The implementation is explicit about the commercial logic. If the parent already has paid or free access, the system unlocks the portal immediately. Otherwise it redirects the parent to the payment flow so that sessions cannot begin until payment is completed.

This detail is important because it means the product is not merely “booking tutoring.” It is a service with gated access, active commercial onboarding, and payment-linked activation.

### 5.5 The parent dashboard is a translation layer for the child’s training state

Once the parent is inside the portal, the dashboard is not a generic overview. It is a translation layer that takes raw topic and performance data and converts it into parent-safe language.

The implementation uses a phase/stability engine with four phases:

- Clarity
- Structured Execution
- Controlled Discomfort
- Time Pressure Stability

And four stability levels:

- Low
- Medium
- High
- High Maintenance

That structure is then translated into parent-facing copy such as:

- “Your child is still building a clear understanding of this topic.”
- “Your child is learning to apply the steps correctly.”
- “Your child is starting to face more challenging problems.”
- “Your child is performing consistently under time pressure.”

This is a very deliberate design choice. The parent is not shown the raw operational labels. They are shown a guided explanation of what that state means for the child.

The parent dashboard also shows metrics such as:

- boss battles completed
- solutions unlocked
- confidence growth
- sessions completed
- current streaks and commitments

These are presented as visible evidence that the child is moving through a training process rather than simply attending lessons.

### 5.6 The student dashboard is a more personal training surface

The student portal is built to feel more immediate and more motivating than the parent portal. The student dashboard queries several endpoints:

- student stats
- student identity
- current topic-conditioning state
- all topic-conditioning states

It then renders a dashboard with:

- boss battles cards
- solutions unlocked cards
- current streak cards
- confidence level cards
- topic-focused state cards that explain the current training condition

The code uses the same phase and stability logic, but translates it into student-facing language. For example, a topic might be described as “being rebuilt from the foundation,” “focused on correct method execution,” or “being trained under difficulty.”

That is one of the clearest differences between this platform and ordinary tutoring. The student is not only seeing “what lesson they are on.” They are seeing what the system believes their current training state is.

### 5.7 The sessions page behaves like a weekly operating calendar

The student sessions page is not just a schedule list. It queries session data and builds a weekly calendar view. It then renders each day with a list of sessions, statuses, and confirmation state.

The implementation distinguishes between statuses such as:

- pending_parent_confirmation
- pending_tutor_confirmation
- confirmed
- ready
- live
- completed

The page also checks whether live lesson scheduling is enabled. If the tutor is in training mode, the UI intentionally changes the experience to show that sessions are running through the platform rather than through scheduled Google Meet windows.

When a session is confirmed and a Google Meet link exists, the student can join directly from the page. That makes the platform feel like an operating environment rather than a passive booking tool.

### 5.8 Assignments turn tutor guidance into visible practice

The student assignments page shows a clear split between pending and completed work. The student can:

- view the assignment instructions
- see the problems that were assigned
- submit their answer
- write out their reasoning and work process

This is important because it moves the student beyond passive consumption. The platform is asking them to show what they did, how they reasoned, and how they approached the work.

### 5.9 Parent reports are a recurring evidence layer

The parent progress page makes the training system visible over time. It fetches weekly and monthly reports and shows them under separate tabs. The code allows the parent to open a report, read the tutor’s analysis, and leave feedback.

That feedback is submitted back to the system through a mutation and then reflected in the parent’s report list. In other words, the platform is designed so that the parent is not just receiving updates. They are participating in a loop of review, feedback, and adjustment.

### 5.10 The platform uses live query updates and mutation loops

A useful code-level detail is that the experience is not static. The UI is built around React Query, which means the application fetches data, then mutates it, and then invalidates or updates the relevant query caches so the page refreshes immediately.

Examples include:

- after a parent proposes an intro session, the app writes the new state into the local query cache and refetches the confirmation state right away
- after a student marks a commitment as complete, the app invalidates the commitments query and the student stats query so the streak and dashboard values update immediately
- after a parent submits feedback on a report, the app invalidates the reports query so the feedback appears in the updated list

This matters because it makes the platform feel responsive and alive. The parent and student are not just looking at a snapshot. They are interacting with a system that is continuously updating the operating picture.

### 5.11 Communication is built into the platform, not treated as an afterthought

The parent and student experiences both include communication surfaces. The parent updates page combines messaging and notifications into a single inbox-style experience. The student updates page does the same for the learner.

In code, these views are built around shared communication and notification components rather than separate ad hoc pages. That means the experience is designed to keep all action-required and informational updates in one place, which reinforces the “single operating environment” feeling.

### 5.12 What this means for the reader

The platform is therefore not a simple tutoring marketplace. It is a service system with:

- a parent-facing intake and review flow
- a tutor assignment and proposal flow
- a payment and access unlock step
- a parent dashboard that translates performance into guidance
- a student dashboard that makes training status visible
- a recurring report and feedback loop

The experience feels structured because the implementation is structured. The UI is not just visual styling. It is a real operational workflow with status transitions, gated access, and state-driven behavior.

## 6. The parent journey: full end-to-end experience

### 3.1 First contact: discovery and entry into the system

The parent first encounters Response Integrity through the public-facing landing and intake experience.

In the current UI, this is framed as a serious and deliberate intake rather than a casual sign-up. The language is focused on:

- calm execution under pressure
- training response rather than just teaching content
- preparation before pressure arrives
- a system that treats academic difficulty as a performance issue that can be trained

The parent is not just being asked to book lessons. They are being invited into an operating system that will assess the learner, diagnose the real pattern of struggle, and build a plan.

The intended feeling is: “This is a serious process, and it is designed for real academic development.”

### 3.2 Intake form: the parent becomes the source of diagnostic truth

Once the parent enters the intake flow, they complete a structured application form.

The form is designed to gather more than basic contact information. It asks for:

- parent full name and contact details
- student full name and grade
- school and context
- where the child gets stuck in mathematics
- specific math topics the child struggles with
- the form in which the child’s difficulty appears, such as word problems, tests, timed work, unfamiliar topics, or careless errors
- previous tutoring history
- internet access and practical readiness
- motivation and alignment information
- consent to the platform terms

This is a key moment because the parent is not simply signing up; they are helping the system build the first diagnostic picture.

The UI experience is highly guided and structured. The form is not a generic contact form. It is designed to feel like an intake into a serious training process.

The parent feels that the company is trying to understand the actual breakpoints in the child’s performance, not just collect basic details.

### 3.3 Submission and “application received” state

After the parent submits the form, the system moves the parent into a review stage.

The UI reflects this through a multi-step journey bar with states such as:

- Applied
- Review
- Assigned
- Active

This is an important design signal. The system is telling the parent that enrollment is not a single click. It is a process of fit review and preparation.

The parent sees a status progression that makes the journey feel orderly and managed.

### 3.4 Review and fit assessment

At this stage, the parent waits while fit is reviewed and a tutor is assigned.

The intended experience is that the service is being carefully evaluated for fit, readiness, and timing. The system is not just “matching a tutor.” It is deciding whether the service is appropriate for the learner and whether the learner is entering at a point where the training model can actually work.

In the implemented UI, this is expressed through waiting states and status updates. There is also a push-notification opt-in, signaling that the parent will be alerted when a tutor is assigned, a proposal is ready, a session needs confirmation, or a report is sent.

The feeling is one of calm but active oversight. The parent is not abandoned during the waiting stage.

### 3.5 Tutor assignment and waiting for acceptance

Once a tutor is assigned, the parent enters the next state: tutor assignment pending acceptance.

The system communicates that the tutor is reviewing the assignment and that intro-session booking will unlock once the tutor accepts.

This stage is important because it creates a sense of handoff. The parent is moving from intake to onboarding, but the service is not yet fully live.

The intended experience is that the system is building a human support layer around the learner, and the parent is waiting for the first operational move.

### 3.6 Intro session booking: the first real operational moment

The next major milestone is the intro session.

The intro session is not an ordinary lesson. It is the first diagnostic encounter that identifies the learner’s real response state inside a topic.

The parent is asked to propose or confirm a time for this session. The UI allows the parent to choose a date and time and submit it. The system then sends the proposed time to the tutor for confirmation.

This is the point where the parent experiences the seriousness of the model. The child is not simply starting lessons; the service is diagnosing how the learner responds when the work begins to break down.

The parent feels that the service is about understanding the learner’s actual operating pattern, not just scheduling tutoring.

### 3.7 Diagnosis and proposal: the parent receives the first translated plan

After the intro session, the parent receives a proposal or diagnosis view.

This is one of the most important parts of the entire experience.

The proposal is not a generic “we will teach your child math.” It is a structured diagnosis that communicates:

- what the child is struggling with
- how the child is currently responding
- what stage of the operating model the learner appears to be in
- what the first training focus should be
- which phases or topics are being conditioned
- what the recommended plan is

The UI is deliberately more thoughtful than a simple lesson plan. It presents the child’s current state in parent-safe language. It uses a phase-based and topic-based interpretation so the parent can understand the child’s position without needing to understand the internal operating system directly.

The intended experience is that the parent is not left with vague “we’ll see” language. The service provides an informed next step.

### 3.8 Acceptance and payment: the parent commits to the service

The proposal includes actions for the parent to accept or decline the plan.

If the parent accepts, the system moves into the commercial or pilot onboarding path.

The key business logic is:

- commercial onboarding can trigger premium payment
- pilot onboarding can allow access without immediate full payment
- payment unlocks the full operational experience
- access can be granted in a pilot mode first, then transition into standard paid access

The UI reflects this with payment-handling and confirmation states. The parent is told that payment is required to unlock sessions and full access.

The business model is therefore felt directly by the parent: the parent is entering a service relationship with real access, real commitment, and a defined operational rhythm.

### 3.9 Portal access: parent becomes a manager of the learner’s journey

Once the proposal is accepted and access is unlocked, the parent enters the main parent portal.

The parent dashboard presents a clear overview of the child’s current training state. The UI uses language such as:

- your child’s current training state
- the next thing Response Integrity is moving forward
- the current observed stage of the topic
- what this means for the child’s development

The parent is not treated as an observer only. The parent becomes an active stakeholder in the child’s developmental journey.

The parent can:

- review the current training plan
- inspect current topic-conditioning states
- see progress markers such as sessions completed, challenge exposure, and structured solutions
- view tutor and proposal information
- see the student access code and manage the child’s access entry point
- message the tutor or access updates

The emotional tone is “you are part of the process, but you are not expected to micromanage it.” The parent is given guidance and visibility, not endless operational complexity.

### 3.10 Ongoing rhythm: reports, updates, and communication

The parent experience continues through recurring touchpoints.

The parent sees:

- weekly reports that describe what happened over the week
- monthly reports that summarize broader movement and the next month’s direction
- progress analytics that show session allocation, usage, and monthly quota
- updates and notifications about platform changes, tutor actions, or system events
- communication inboxes for messages to and from tutors

The parent is therefore not waiting until an exam or crisis to see what is happening. The system continuously translates the child’s training into readable progress.

This is one of the most important parts of the intended experience. The parent is not just paying for lessons; they are receiving structured, periodic evidence of development.

### 3.11 What the parent ultimately experiences emotionally

The intended parent journey feels like this:

- first, a serious intake process that respects the child’s learning challenge
- then, a diagnostic and planning phase that gives meaning to the service
- then, a commitment phase where the family enters the recurring model
- then, a visibility phase where the parent sees progress through structured reporting rather than vague reassurance

The parent should feel that the service is guided, accountable, and built around real progress rather than personality or chance.

---

## 6. The student journey: full end-to-end experience

### 4.1 Student entry: joining the training environment

The student enters the system through the student portal, usually after the parent’s flow has created the learner’s access context.

The student experience is designed to feel cleaner, more personal, and more motivating than the parent experience. The student’s portal is less about admin and more about active training participation.

The student sees a welcome experience that frames the work as training, not rescue.

### 4.2 Dashboard: the student sees a training overview

The student dashboard is the main entry point.

It presents:

- a welcome message
- a “training overview” framing
- topic focus cards that describe the current topic state
- training markers that summarize what has happened recently
- quick actions for sessions, assignments, and updates

The dashboard is meant to make the student feel that they are part of an active system. It does not feel like a generic school portal. It feels like a personal training environment.

The student sees visible metrics such as:

- sessions completed
- challenge exposure
- structured solutions
- topics in conditioning

These are intended to make progress feel visible, measurable, and motivating.

### 4.3 Topic focus: the student sees their current training state

A major difference between this model and ordinary tutoring is that the student is not simply seeing “lesson topics.” They see the current state of the topic being trained.

Each topic card communicates:

- the topic name
- the current phase or stage
- the stability level
- the current meaning of that state
- the current focus of the work
- the last updated time

This helps the student understand that the work is not random. The system is identifying where the difficulty currently exists and what the next step is.

The student is therefore not only “doing work.” They are participating in a structured conditioning process.

### 4.4 Sessions page: the student sees the schedule and the rhythm

The sessions page provides the student’s weekly schedule.

The student sees:

- the weekly calendar view
- session status
- intro vs training session labels
- confirmation state
- scheduling context
- Google Meet access when applicable

The UI is designed to make the schedule feel centralized and manageable. The student can see what is upcoming and whether the session is confirmed.

The experience is practical and reassuring. The student is not left guessing whether a lesson exists or whether it is locked in.

### 4.5 Assignments: the student becomes an active participant in practice

The student also has an assignment surface.

The assignment experience is designed to convert tutor guidance into visible practice. The student can:

- see pending and completed assignments
- review the instructions and problems assigned
- submit their answer or result
- explain their reasoning and work process

This is a meaningful part of the student journey because it encourages more than answer-getting. It asks the student to show how they thought about the problem.

The student is therefore not only receiving help; they are also developing a habit of explaining their process, which is central to the Response Integrity operating philosophy.

### 4.6 Communication and updates: the student stays inside the system

The student also has an on-platform communication experience.

The student can receive:

- tutor messages
- action-required notifications
- informational updates

This creates a contained environment where the student is not relying on scattered messages or disconnected communication. The system becomes the central communication layer for the training relationship.

In the implementation, this is not just a static messaging list. The student updates page uses the same communication-inbox pattern as the parent experience, with a combined view for messages and platform notifications. The student can therefore experience the training relationship as a single, continuous environment rather than a collection of separate tools.

### 4.7 Growth and reflection: the student is asked to own the habit layer

The student portal also contains a growth experience that goes beyond lessons and assignments.

The student can:

- create commitments
- edit or delete commitments
- log completion for the day
- build a streak
- write reflections and record mood

This is an important behavioral detail. The platform is not only asking the student to complete tutoring tasks. It is asking them to own a daily habit layer and to reflect on how they are responding to the work.

That is a significant part of the product identity. The system is trying to make the learner more internally organized, more self-aware, and more accountable, not simply more “taught.”

### 4.7 Growth and reflection: the student becomes aware of their own habits and mindset

The broader implementation documents describe a more reflective layer for the student experience, including:

- commitments
- daily completion logs
- reflections and journaling
- streak tracking
- academic profile tracking

Although the current UI surface is centered more on dashboard, sessions, assignments, and updates, the intended student experience is broader. It is meant to help the student internalize the discipline of training: showing up, reflecting, practicing, and tracking progress.

This is important because the student experience is meant to feel developmental, not merely administrative.

### 4.8 What the student ultimately experiences emotionally

The intended student journey feels like this:

- first, a sense of entry into a serious training environment
- then, a clear understanding of the current topic and the current challenge
- then, a rhythm of sessions and assignments that makes learning feel active rather than passive
- then, visible progress through metrics, reflections, and tutor communication

The student should feel that the work is structured, purposeful, and personal. They are not merely “being tutored.” They are participating in a growth process.

---

## 7. How the parent and student experiences fit together

The parent and student experiences are intentionally different, but they are designed to reinforce each other.

The parent sees the translated system:

- the child’s current training state
- the diagnosis and plan
- the progress reports
- the weekly/monthly movement
- the next step in the program

The student sees the lived system:

- the schedule
- the topic focus
- the assignments
- the updates
- the training rhythm

The parent is the strategic stakeholder. The student is the active participant. The tutor and platform are the operational bridge between them.

This split matters because it creates a coherent service model:

- the parent receives clarity and accountability
- the student receives direct participation and structure
- the tutor operates the training process
- the system translates the output into understandable progress

---

## 8. What the experience is trying to feel like

Taken together, the intended client experience is meant to feel:

- calm rather than chaotic
- systematic rather than improvised
- individualized rather than generic
- evidence-based rather than superficial
- developmental rather than rescue-oriented

The experience is not built around “we’ll see what happens.” It is built around a clear sequence:

1. understand the learner
2. diagnose the real difficulty
3. create a training plan
4. begin structured work
5. observe response over time
6. report measurable movement
7. adjust based on evidence

That is the shape of the full parent and student journey.

---

## 9. The practical reality of the current implementation

The current codebase shows that the parent and student portals are real and operational, but they are still in the process of being fully productized.

The implemented UI clearly supports:

- parent intake and application flow
- parent proposal and acceptance flow
- parent dashboard, progress, and updates
- student dashboard, sessions, assignments, and updates

The documentation and operating model extend this further into a richer experience involving:

- phase-based topic conditioning
- structured progress reporting
- weekly and monthly reporting
- challenge exposure and structured solutions as visible markers
- student commitments, reflections, and academic profile tracking

So the current implementation is already strong in the operational core, while the broader vision continues to expand the experience into a more complete developmental platform.

---

## 10. Bottom line

The parent experience is a guided, structured journey from intake to diagnosis to commitment to ongoing visibility. The parent is not just buying tutoring; they are entering a recurring training relationship with clear evidence of progress.

The student experience is a lived training journey from entry into the portal to participation in sessions, assignments, communication, and reflection. The student is not just attending lessons; they are participating in a disciplined system that trains response under difficulty.

Together, the model aims to make the family feel that the learner is being understood, guided, and developed through a coherent operating rhythm rather than through ad hoc support.
