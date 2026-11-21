# People vs ghosts

Human sessions recorded with `?human=1` (players: rafa). Ghost findings from the `baseline-v2` benchmark runs of the same variant.

**Spots where a person died or ended up stuck that the ghosts also flagged: 4/4.**

| Player | Game | Variant | Person: outcome | Time | Deaths | Where the person had trouble | Flagged by the ghosts? | Ghost findings on this variant |
|---|---|---|---|---|---|---|---|---|
| rafa | gap-run | clean | won | 15s | 0 | — (no trouble spot) | — | friction!@(1017,360), friction!@(690,360), friction!@(376,360), friction!@(1024,360), friction!@(370,360), friction@(677,360) |
| rafa | gap-run | gap | playing | 12s | 3 | deaths ×3 at (1120,360); ended here ×24 at (910,267) | yes (blocker); yes (blocker) | blocker!@(1042,360), friction!@(365,360), friction!@(681,360), blocker!@(1027,360), friction!@(686,360), friction!@(376,360) |
| rafa | key-hunt | clean | won | 11s | 0 | — (no trouble spot) | — | — |
| rafa | key-hunt | hidden-key | won | 10s | 0 | — (no trouble spot) | — | missed@(568,296), missed!@(568,296), stuck!@(354,224) |
| rafa | lever-room | clean | won | 7s | 0 | — (no trouble spot) | — | — |
| rafa | lever-room | no-hint | won | 13s | 0 | — (no trouble spot) | — | missed!@(64,226), stuck!@(487,239), missed!@(64,226), stuck!@(489,244) |
| rafa | spike-maze | clean | won | 8s | 0 | — (no trouble spot) | — | friction!@(155,312), friction@(506,88), friction!@(507,88), friction@(416,113) |
| rafa | spike-maze | hidden-spikes | won | 10s | 1 | deaths ×1 at (410,120) | yes (friction) | blocker!@(155,312), missed!@(304,312), missed@(304,312), friction!@(155,312), friction@(230,312), friction@(411,120) |
| rafa | read-me | clean | won | 7s | 1 | deaths ×1 at (398,322) | yes (friction) | friction!@(343,320), friction!@(351,321) |
| rafa | read-me | wrong-key | won | 4s | 0 | — (no trouble spot) | — | blocker!@(334,322), missed!@(240,286), blocker!@(320,322), missed!@(240,286) |

A person's trouble spot is a cluster of their deaths, or the area where they spent the last 40% of a session they did not finish. "Flagged" = a ghost finding (medium or high severity) overlaps it.
