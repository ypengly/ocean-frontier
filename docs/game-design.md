# Game design

## Loop
Dive from the surface station, ping with sonar to find sites, scan creatures and collect resources, return before air or battery run out, spend materials on upgrades, dive deeper.

## Survival numbers (Explorer, no upgrades)
- Air: 700 s at the surface, drains faster with depth, plus a 60 s emergency reserve. Surfacing refills air and slowly recharges the battery.
- Battery: 1500 units. Idle 0.25/s, full throttle +1.6/s, lights +0.3/s, a sonar ping costs 4.
- Safe depth: 120 m. Beyond it the hull takes damage that grows with excess depth.
- No power: emergency ballast lifts the sub toward the surface.
- Failure: hull at 0 or air and reserve both gone. Respawn keeps progress and artifacts and loses 25% of other carried materials.

## Missions
Catalogue 3 species, collect 3 water samples, find the hidden cave (needs sonar), find the ancient pillar (about 100 m deep), recover the wreck cargo (hidden, needs sonar), dive to 70 m and return.

## Creature behaviour
- Schools: cohesion, alignment, separation, a home range, wander noise, floor and surface avoidance, and a flee response that scales with the submarine's speed.
- Reef shark: patrol, investigate when the sub is close and moving or lit, circle, leave, with a cooldown. A very fast approach startles it.
- Turtles follow reef loops and speed up if the sub rushes them. Jellyfish drift on the current field.
