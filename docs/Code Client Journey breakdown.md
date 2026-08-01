# Parent, Student, and Tutor Client Journey: UI Tour

This document is written as a guided walkthrough of the experience. Instead of reading like a summary, it reads like a tour: where the user lands, what they see, what they click, and what happens next.

The structure below follows the actual product flow as implemented in the portal and the supporting UI logic.

---

## 1. The user lands at the intake gateway

The journey begins on a serious, purpose-driven intake screen.

What the user sees:
- a branded experience that feels more like an application for a training system than a casual signup form
- messaging about response training, preparedness, and performance under pressure
- a clear sense that this is not ordinary tutoring

What the user does:
- they read the framing and understand that they are entering a structured process
- they begin the application rather than simply booking a lesson

What happens next:
- the system treats the user as someone entering a review-based onboarding flow, not as someone making a one-click purchase

The emotional tone is: “This is a serious process, and it is designed to understand my child properly before anything starts.”

---

## 2. The user enters the application form

Once the user moves into the form, the experience shifts from general messaging to guided intake.

What the user sees:
- fields for parent and student details
- school, grade, and background information
- questions about where the student gets stuck in mathematics
- a place to add specific topics the user is concerned about
- a set of symptom-style choices that describe how the struggle shows up

What the user clicks:
- they type in the student’s name, grade, school, and contact details
- they choose the areas where the student struggles most
- they add math topics one by one
- they select how the difficulty appears in practice, such as word problems, tests, timed work, or careless errors

What happens next:
- the system collects these details as diagnostic input rather than simple profile data
- the form becomes the first layer of the learner’s operational picture

The emotional tone is: “The platform is trying to understand the real problem, not just collect basic contact details.”

---

## 3. The user submits the application and sees the system move into review

After the form is submitted, the user is no longer in a blank intake screen. They are moved into a review status flow.

What the user sees:
- a progress-style journey bar with stages such as Applied, Review, Assigned, and Active
- a confirmation that the application has been received
- messaging that the process is now being assessed

What the user does:
- they wait for the system to evaluate fit and prepare the next step

What happens next:
- the system begins the backend review process
- the UI changes to reflect that the user is now in a managed onboarding stage rather than still filling out forms

The emotional tone is: “This is now being handled. The system is taking this seriously.”

---

## 4. The user reaches the assignment and waiting stage

At this point, the journey becomes more about patience and anticipation than active form completion.

What the user sees:
- status messaging that explains the application is being assessed
- update prompts that suggest a tutor may soon be assigned
- a push-notification opt-in that makes it clear the user will be alerted when important changes happen

What the user does:
- they wait, but they are not left in the dark
- they are told the system is still working on their placement

What happens next:
- the platform moves the user toward tutor assignment, and the next visible change is usually the arrival of a tutor or a proposal state

The emotional tone is: “The process is active, but it is still in motion.”

---

## 5. The user arrives at the tutor-assignment stage

This is the first major handoff moment.

What the user sees:
- a screen that says a tutor has been assigned or that assignment is pending acceptance
- a waiting state that indicates the tutor is reviewing the assignment
- an option to proceed to the intro-session step once the tutor accepts

What the user does:
- they read the assignment status and understand that the human support layer is now being introduced

What happens next:
- the system prepares the next operational milestone: the intro session

The emotional tone is: “The service is becoming real. A tutor is now involved.”

---

## 6. The user books the intro session

The intro session is the first real operational moment in the relationship.

What the user sees:
- a booking dialog or scheduling interface
- a date picker and time selector
- a clear action to propose a time for the session

What the user clicks:
- they pick a date
- they choose a time
- they submit the proposal

What happens next:
- the requested time is sent to the tutor for confirmation
- the interface updates to show that the booking is pending or confirmed depending on the tutor response

If the tutor proposes a different time, the user sees a follow-up state that asks them to confirm the revised slot. That makes the booking feel like a real back-and-forth process rather than a simple calendar event.

The emotional tone is: “We are not just starting lessons. We are starting with a diagnostic step.”

---

## 7. The user reaches the proposal view

This is one of the most important moments in the journey.

What the user sees:
- a proposal or diagnosis view that explains the learner’s current state in a parent-friendly way
- a structured breakdown of the child’s current difficulty and the likely training direction
- language that translates raw assessment logic into something understandable for a parent

What the user does:
- they read the proposal
- they review the recommended direction
- they decide whether to accept or decline it

What happens next:
- the platform moves from general intake into a specific training recommendation

The emotional tone is: “Now the system is telling us what it thinks is actually happening and what should happen next.”

---

## 8. The user accepts the proposal and enters the commercial step

This is where the journey becomes a paid service relationship rather than just an assessment.

What the user sees:
- a clear accept-or-decline action on the proposal
- different outcomes depending on the access type
- either an immediate access confirmation, a pilot-access path, or a payment redirect

What the user clicks:
- they accept the plan
- they either confirm payment or move through a pilot-style onboarding route

What happens next:
- once access is unlocked, the user enters the main portal experience
- if payment is required, the system gates access until it is completed

The emotional tone is: “This is now a commitment. The service is being activated.”

---

## 9. The parent lands in the parent dashboard

Once inside the portal, the parent is no longer looking at a signup flow. They are now looking at a training environment.

What the user sees:
- a dashboard that presents the child’s current training state
- summary metrics such as sessions completed, boss battles, solutions unlocked, confidence growth, and streaks
- a framing that explains not just what happened, but what the child is currently working on

What the user clicks:
- they review the current training state
- they inspect the child’s topics and progress markers
- they open the proposal or tutor information if needed

What happens next:
- the parent begins to see the child’s journey as something structured and visible rather than vague and reactive

The emotional tone is: “I can see the system at work, and I can understand what is being built.”

---

## 10. The student lands in the student portal

The student experience is deliberately more personal and less administrative than the parent dashboard.

What the user sees:
- a cleaner, more motivating training-focused dashboard
- visible cards for current metrics such as boss battles, solutions unlocked, streaks, and confidence
- topic-based state cards that explain what the student is currently working on

What the user does:
- they see their current training status in a more direct, student-facing way
- they understand that the work is about conditioning, not just completing lessons

What happens next:
- the student begins to see the platform as a place where their effort, progress, and habits are tracked

The emotional tone is: “This feels more like a training environment than a school portal.”

---

## 11. The student opens the sessions page

This is the weekly rhythm view.

What the user sees:
- a week-by-week schedule
- session cards for each day
- status labels such as awaiting confirmation, confirmed, ready, live, or completed
- a next-session summary

What the user clicks:
- they look at the upcoming week
- they check whether a session is confirmed
- they may join a live session if the link is available

What happens next:
- the system makes the student’s weekly rhythm feel concrete and visible
- the student can clearly see what is scheduled and what still needs confirmation

The emotional tone is: “The week is organized. I know where I am supposed to be.”

---

## 12. The student opens the assignments page

This is where the training becomes more active and visible.

What the user sees:
- pending assignments and completed assignments in separate states
- instructions, problems, and submission areas
- a clear distinction between work that still needs to be done and work already completed

What the user does:
- they open an assignment
- they read the instructions
- they submit their answer and explain their thinking

What happens next:
- the platform turns tutor guidance into visible practice rather than passive listening

The emotional tone is: “I am not just being helped. I am now showing my work and participating in the process.”

---

## 13. The student enters the growth area

This part of the experience moves beyond tutoring tasks into habit building and reflection.

What the user sees:
- commitment cards and streak tracking
- options to create, edit, or complete commitments
- reflection prompts and mood-based journaling

What the user clicks:
- they add a commitment
- they mark it as complete for the day
- they write a reflection about how they are doing

What happens next:
- the system updates the student’s streak, visible progress, and self-reporting layer

The emotional tone is: “The platform is asking me to build habits and reflect, not just answer questions.”

---

## 14. The parent opens the progress and report view

This is the evidence layer of the experience.

What the user sees:
- weekly and monthly reports
- tutor commentary about what changed over time
- progress summaries and next-step guidance
- a feedback area where the parent can respond to the report

What the user does:
- they read the tutor’s interpretation of the student’s progress
- they leave feedback if needed

What happens next:
- the platform turns the child’s development into a visible, reviewable story rather than an isolated lesson-by-lesson timeline

The emotional tone is: “I can follow the child’s development over time.”

---

## 15. The user lands in the updates and communication layer

The platform keeps communication inside the system rather than scattered across messages and emails.

What the user sees:
- messages with the tutor
- action-required notifications
- informational updates
- a central inbox-like experience

What the user does:
- they read updates, respond to messages, and keep track of what requires action

What happens next:
- the platform feels like one operating environment rather than a collection of disconnected tools

The emotional tone is: “Everything important is in one place.”

---

## 16. The tutor journey sits behind the scenes, but shapes everything the family experiences

The family experience only works because the tutor side is structured behind it.

What the user does not see directly:
- the tutor’s application and training stages
- the certification process
- the protected sandbox phase before live delivery

What the user experiences indirectly:
- a more trustworthy service because the tutor is not just “available,” but part of a guided operating system
- a stronger sense of structure because the tutor is also being trained inside the same model

The emotional tone is: “The service feels more dependable because it is not relying on improvisation.”

---

## 17. The overall feel of the experience

Taken together, the journey reads less like a tutoring app and more like a guided performance-training environment.

The user moves through a sequence of moments:
1. they arrive at a serious intake experience
2. they fill out a diagnostic form
3. they wait while the system reviews fit
4. they move into assignment and tutor onboarding
5. they book an intro session
6. they receive a proposal
7. they enter a paid or pilot access state
8. they see their child’s progress through dashboards, sessions, assignments, reports, and updates

That is the core tour of the product: an experience built to feel calm, structured, and accountable from the first click onward.

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
