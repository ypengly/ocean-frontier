INSERT INTO species (id, name, category, size_class, zones, min_depth, max_depth, description) VALUES
('clownfish','Clownfish','Fish','small','{reef}',1,15,'Lives among anemones and defends a small territory.'),
('sardine','Sardine','Fish','small','{reef}',0,60,'Forms dense schools that scatter from predators.'),
('jellyfish','Moon Jellyfish','Cnidarian','small','{reef}',0,40,'Drifts with the current and pulses to hold depth.'),
('sea_turtle','Green Sea Turtle','Reptile','medium','{reef}',0,40,'Grazes seagrass and returns to the same reef each season.'),
('reef_shark','Blacktip Reef Shark','Fish','medium','{reef}',1,60,'Curious about unfamiliar objects; circles before leaving.'),
('whale_shark','Whale Shark','Fish','large','{reef,trench}',0,700,'The largest fish; filter feeds on plankton.'),
('anglerfish','Anglerfish','Fish','deep','{trench}',200,2000,'Lures prey with a bioluminescent organ.')
ON CONFLICT (id) DO NOTHING;
