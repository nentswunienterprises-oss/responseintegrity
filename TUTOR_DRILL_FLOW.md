# Tutor Drill Flow

## Purpose

This is the tutor-side flow for running drills in the app and how those drills affect student state and reporting.

## Core Logic

- A training session is a container.
- A drill is the scoring unit.
- State changes happen per drill, not per session.
- Reports are generated from drills, then grouped into session-based reporting windows.

## Tutor Flow In App

1. Open the student in the tutor view.
2. Go to the drill runner / topic conditioning flow.
3. Select or confirm the topic being trained.
4. Run the drill the app gives for that topic and current state.
5. Record observations during the drill.
6. Submit the recorded behavior evidence for the drill.
7. The system updates the topic state from the evidence decision for that drill.
8. If time allows, run another drill in the same training session for the same or another topic.
9. End the training session when the tutor is done.

## What The System Does After Each Drill

- Stores the drill result.
- Maps observation signals into behavior labels.
- Updates the topic phase and stability.
- Decides the next action for that topic.
- Adds the drill to the reporting data.

## Sessions vs Drills

- Single-drill session: one session contains one drill.
- Multi-topic session: the session contains drills across different topics.

The tutor runs drills. The app later groups those drills into the session view.

## Reporting Logic

- Weekly report: generated after 2 grouped training sessions.
- Monthly report: generated after 8 grouped training sessions.
- Session counts in reports should reflect grouped sessions.
- Drill counts remain separate metadata.

## Parent-Facing Rule

- Parents should not see internal engine language.
- Parent outputs should explain meaning, progress, and next focus in plain language.

## Tutor Standard

- Do not freestyle the state logic.
- Do not collapse the whole session into one generic result.
- Record each drill's behavior evidence accurately.
- Keep observations clear because reporting quality depends on them.
