# Changelog

## 1.14.0 (2026-10-26): pumpkin costumes
- 10 corny Halloween costumes for the pumpkin: witch, Dracula, Groucho glasses, pirate (eyepatch over one eye, the other still animates), Frankenstein, mummy, ghost, wizard, devil, skeleton. A plain pumpkin turns up about 1 time in 11.
- Costumes are layered canvas shapes. Masks and face paint sit under the white eyes and the eyes move less inside eye holes. Everything rocks with the pumpkin.
- A new costume each time the look comes up, every 2–4 minutes (smoke poof, a little spin, the hat drops on), or on a single tap of the pumpkin. A double-tap still changes looks.
- A short pun caption under the pumpkin after each change, kept above the wordmark and away from the clock and gauge.
- The pumpkin is slightly smaller and lower so the tallest hats and the wizard beard always fit.

## 1.13.0 (2026-10-26): Grok Bot pumpkin
- New `pumpkin` look: flat orange pumpkin with a lobed bottom, faint rib shading and a curly stem. White Grok Bot eyes are dots at rest and pills that dart around when active, and the pumpkin rocks left and right (on the beat when music plays).
- Halloween window: the opening look Oct 25 – Nov 1 and a frequent auto pick, in auto-rotation through October, swipe-only the rest of the year. `?halloween=1|0` overrides it.
- Shared eye renderer: optional width/height/happy-arc scaling (the other looks are unchanged).

## 1.12.2 (2026-10-26)
- Rock-paper-scissors no longer starts on its own. A fist only counts while a face is looking at the tablet, thumbs-up / pointing / ILY are ignored, and hand boxes plus confidence gate each throw.

## 1.12.1 (2026-10-25)
- Tap the little clock (or the invite chip) to start rock-paper-scissors. Fist hold-to-start with a progress ring.
- The hand model runs only while someone is around (about 5 fps, full rate while a hand is in view or a game is on).

## 1.12.0 (2026-10-25)
- Rock-paper-scissors against the bot with camera hand gestures (on-device MediaPipe), with countdown, reveal and a best-of-three final.
- Thermostat pace forecast: projected end-of-cycle spend and a single "on pace" / "hits limit ~day" line. Quicker blinks and a nervous side-glance when on pace to overspend, a content glance when relaxed.
- adb debug hooks: `--es look rps` and `--es look rpsfist`.

## 1.11 (2026-10-25)
- The thin plan-usage meter becomes a seamless thermostat gauge on its own strip along the right edge. The stage narrows to fit.
