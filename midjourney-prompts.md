# NIN DEFENDER — Midjourney Prompts

## Tips

- Use `--ar 2:1` for horizontal format (bosses face left)
- Add `--style raw` if results are too stylized
- Add `--no background noise texture` if backgrounds aren't clean black
- Save as `assets/boss-0.png` through `assets/boss-9.png`
- Black backgrounds blend into space; for clean edges use circular mask:
  ```bash
  magick boss-0.png \( +clone -threshold 101% -fill white -draw "circle 512,512 512,508" \) -channel-fx '| gray=>alpha' boss-0.png
  ```

## Boss Prompts

### Boss 0 — Critter Colony (Armored Bug)
```
giant alien armored beetle boss, segmented carapace shell, long antennae, glowing yellow eyes, sharp mandibles, dark brown and orange, side view facing left, black background --ar 2:1 --v 6
```

### Boss 1 — Firefly Swarm (Queen Firefly)
```
giant bioluminescent queen firefly boss, translucent wings, glowing green-yellow abdomen, ethereal light aura, insectoid, side view facing left, black background --ar 2:1 --v 6
```

### Boss 2 — Jellyfish Drift (Giant Jellyfish)
```
massive space jellyfish boss, translucent pink-magenta dome bell, long flowing tentacles, bioluminescent glow, ethereal, side view facing left, black background --ar 2:1 --v 6
```

### Boss 3 — Arachnid Sector (Spider Queen)
```
giant alien spider queen boss, 12 legs, bulbous green-black abdomen with toxic markings, 8 glowing red eyes, mandibles, menacing, side view facing left, black background --ar 2:1 --v 6
```

### Boss 4 — Ghost Nebula (Wraith)
```
giant translucent space ghost wraith boss, flowing wispy tendrils, hollow glowing white eyes, purple ethereal body, haunting, semi-transparent, side view facing left, black background --ar 2:1 --v 6
```

### Boss 5 — Octopus Den (Kraken)
```
massive space octopus kraken boss, 8 flowing tentacles with suckers, bulbous purple dome head, bioluminescent spots, intelligent rectangular pupil eyes, side view facing left, black background --ar 2:1 --v 6
```

### Boss 6 — Chameleon Void (Color Shifter)
```
giant alien chameleon boss, iridescent color-shifting scales, curled tail, large rotating eyes with slit pupils, stubby legs, rainbow shimmer skin, side view facing left, black background --ar 2:1 --v 6
```

### Boss 7 — Devil's Domain (Demon Lord)
```
massive space demon devil boss, curved horns, dark red skin, fiery aura, glowing yellow slit eyes, jagged fanged mouth, flames trailing, menacing, side view facing left, black background --ar 2:1 --v 6
```

### Boss 8 — Devil's Domain variant (Infernal)
```
infernal space demon boss, massive twisted horns, molten lava cracks in dark skin, burning eyes, fire wings, apocalyptic, side view facing left, black background --ar 2:1 --v 6
```

### Boss 9 — Total Chaos (Final Boss / CLOSER)
```
ultimate cosmic horror final boss, amalgamation of all creatures, tentacles horns legs eyes, NIN logo branded on body, red and black, industrial nightmare, eldritch abomination, side view facing left, black background --ar 2:1 --v 6
```

## Enemy Prompts (future)

### Alien Critter
```
small alien bug creature, antennae, segmented body, scuttling legs, beady yellow eyes, dark orange-brown, side view facing left, black background --ar 2:1 --v 6
```

### Space Firefly
```
tiny bioluminescent space firefly, translucent wings, glowing yellow-green abdomen, insect, side view facing left, black background --ar 2:1 --v 6
```

### Space Jellyfish
```
small translucent space jellyfish, pink dome bell, trailing tentacles, bioluminescent, side view facing left, black background --ar 2:1 --v 6
```

### Space Octopus
```
alien octopus, purple bulbous head, flowing tentacles, bioluminescent spots, side view facing left, black background --ar 2:1 --v 6
```

### Space Chameleon
```
alien chameleon, color-shifting iridescent scales, curled tail, large rotating eye with slit pupil, side view facing left, black background --ar 2:1 --v 6
```

## Planet Prompts

### Red Planet with NIN
```
cratered red mars-like planet, NIN logo carved into rocky surface, dark atmosphere, space view, cinematic lighting, black background --ar 1:1 --v 6
```

### Ice Moon with NIN
```
frozen alien moon, NIN logo etched into glacial ice surface, craters, blue-grey, space view, cinematic, black background --ar 1:1 --v 6
```

### Gas Giant with NIN
```
massive gas giant planet, swirling storm bands, NIN logo visible in red storm eye, dark space, cinematic, black background --ar 1:1 --v 6
```
